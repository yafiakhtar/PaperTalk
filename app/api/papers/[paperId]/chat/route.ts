import { NextResponse } from "next/server";
import { createGeminiChatCompletion } from "@/lib/gemini.server";
import { PAPER_SELECT, type Paper } from "@/lib/papers";
import {
  selectRelevantChunks,
  type PaperChunkForRetrieval
} from "@/lib/paper-retrieval.server";
import {
  MESSAGE_SELECT,
  normalizeMessage,
  type MessageCitation,
  type PaperMessage
} from "@/lib/messages";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

interface PaperWithOwner extends Paper {
  owner_id: string;
}

interface ContextSource {
  label: string;
  chunk: PaperChunkForRetrieval;
}

function getShortErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not answer this question.";
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

function getQuestionFromBody(body: unknown) {
  if (!body || typeof body !== "object" || !("content" in body)) return "";
  return typeof body.content === "string" ? body.content.trim() : "";
}

function isGeneralAssistantMessage(question: string) {
  const normalizedQuestion = question
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /^(hi|hello|hey|yo|howdy|sup)\b/.test(normalizedQuestion) ||
    /\b(how are you|who are you|what is your name|what's your name|your name|what can you do|help me use|how do i use)\b/.test(
      normalizedQuestion
    ) ||
    /^(thanks|thank you|ty|bye|goodbye|see you|later)\b/.test(normalizedQuestion)
  );
}

function buildContextSources(chunks: PaperChunkForRetrieval[]) {
  return chunks.map((chunk, index) => ({
    label: `S${index + 1}`,
    chunk
  }));
}

function formatContext(sources: ContextSource[]) {
  if (sources.length === 0) {
    return "No relevant paper excerpts were found for this message.";
  }

  return sources
    .map(
      (source) =>
        `[${source.label} | Page ${source.chunk.page_number}]\n${source.chunk.text.trim()}`
    )
    .join("\n\n---\n\n");
}

function cleanModelAnswer(answer: string) {
  return answer
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\n{1,2}\s*(?:\*\*)?Citations?:[\s\S]*$/i, "")
    .replace(/\bChunks?\s+[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "the cited excerpt")
    .replace(/([a-z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getValidSourceIndexes(value: string, sourceCount: number) {
  const sourceIndexes: number[] = [];
  const sourcePattern = /\b(?:s|source)\s*(\d+)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = sourcePattern.exec(value)) !== null) {
    const sourceIndex = Number(match[1]) - 1;
    if (
      Number.isInteger(sourceIndex) &&
      sourceIndex >= 0 &&
      sourceIndex < sourceCount &&
      !sourceIndexes.includes(sourceIndex)
    ) {
      sourceIndexes.push(sourceIndex);
    }
  }

  return sourceIndexes;
}

function formatPageMarker(sourceIndexes: number[], sources: ContextSource[]) {
  const pages = Array.from(
    new Set(sourceIndexes.map((sourceIndex) => sources[sourceIndex]?.chunk.page_number))
  )
    .filter((page): page is number => Number.isInteger(page) && page > 0)
    .sort((a, b) => a - b);

  if (pages.length === 0) return "";
  if (pages.length === 1) return `[Page ${pages[0]}]`;
  return `[Pages ${pages.join(", ")}]`;
}

function buildCitationsFromSourceIndexes(
  sourceIndexes: number[],
  sources: ContextSource[]
) {
  const seenChunkIds = new Set<string>();
  const citations: MessageCitation[] = [];

  sourceIndexes.forEach((sourceIndex) => {
    const chunk = sources[sourceIndex]?.chunk;
    if (!chunk || seenChunkIds.has(chunk.id)) return;

    seenChunkIds.add(chunk.id);
    citations.push({
      page: chunk.page_number,
      chunkId: chunk.id
    });
  });

  return citations;
}

function buildCitationsFromPageMarkers(answer: string, sources: ContextSource[]) {
  const seenPages = new Set<number>();
  const pagePattern = /\[Pages?\s+([0-9,\s]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = pagePattern.exec(answer)) !== null) {
    const pageNumbers = match[1]
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((page) => Number.isInteger(page) && page > 0);

    pageNumbers.forEach((page) => seenPages.add(page));
  }

  return Array.from(seenPages)
    .sort((a, b) => a - b)
    .map((page) => sources.find((source) => source.chunk.page_number === page)?.chunk)
    .filter((chunk): chunk is PaperChunkForRetrieval => Boolean(chunk))
    .map((chunk) => ({
      page: chunk.page_number,
      chunkId: chunk.id
    }));
}

function normalizeAnswerCitations(answer: string, sources: ContextSource[]) {
  const citedSourceIndexes: number[] = [];
  const seenSourceIndexes = new Set<number>();
  const content = answer.replace(/\[([^\[\]]+)\]/g, (marker, inner: string) => {
    const sourceIndexes = getValidSourceIndexes(inner, sources.length);
    if (sourceIndexes.length === 0) return marker;

    sourceIndexes.forEach((sourceIndex) => {
      if (seenSourceIndexes.has(sourceIndex)) return;
      seenSourceIndexes.add(sourceIndex);
      citedSourceIndexes.push(sourceIndex);
    });

    return formatPageMarker(sourceIndexes, sources) || marker;
  });
  const sourceCitations = buildCitationsFromSourceIndexes(citedSourceIndexes, sources);

  return {
    content,
    citations:
      sourceCitations.length > 0
        ? sourceCitations
        : buildCitationsFromPageMarkers(content, sources)
  };
}

function buildModelMessages(
  paper: PaperWithOwner,
  question: string,
  sources: ContextSource[],
  recentMessages: PaperMessage[]
) {
  const history = recentMessages.slice(-6).map((message) => ({
    role: message.role,
    content: message.role === "assistant" ? cleanModelAnswer(message.content) : message.content
  }));

  return [
    {
      role: "system" as const,
      content:
        "You are PaperTalk, a careful research-paper assistant inside an AI web app. For greetings, small talk, and questions about what you can do, respond naturally and briefly. For paper-specific questions, answer only from the provided paper excerpts. If no relevant excerpts are provided, say you do not see that in the available paper context and suggest a more specific paper question. Cite paper-specific factual claims inline with the provided source IDs, using markers like [S1] or [S1, S3]. Use only source IDs that appear in the relevant paper excerpts. Do not cite greetings, small talk, or missing-context responses. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, and no final citations section. Keep the answer to one or two short paragraphs by default. Do not invent citations, studies, methods, or results."
    },
    ...history,
    {
      role: "user" as const,
      content: `Paper title: ${paper.title}\n\nRelevant paper excerpts:\n${formatContext(
        sources
      )}\n\nQuestion: ${question}`
    }
  ];
}

async function insertMessage(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  paperId: string,
  ownerId: string,
  role: "user" | "assistant",
  content: string,
  citations: MessageCitation[] = []
) {
  const { data, error } = await supabase
    .from("paper_messages")
    .insert({
      paper_id: paperId,
      owner_id: ownerId,
      role,
      content,
      citations
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;
  return normalizeMessage(data as Record<string, unknown>);
}

export async function POST(request: Request, context: RouteContext) {
  const { paperId } = await context.params;
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const question = getQuestionFromBody(await request.json().catch(() => null));

  if (!question) {
    return NextResponse.json({ error: "Ask a question about this paper." }, { status: 400 });
  }

  if (question.length > 2000) {
    return NextResponse.json(
      { error: "Questions must be 2,000 characters or less." },
      { status: 400 }
    );
  }

  const { data: paperData, error: paperError } = await supabase
    .from("papers")
    .select(`${PAPER_SELECT},owner_id`)
    .eq("id", paperId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (paperError) {
    return NextResponse.json({ error: paperError.message }, { status: 500 });
  }

  if (!paperData) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  const paper = paperData as PaperWithOwner;

  if (paper.status !== "ready" || paper.extraction_status !== "completed") {
    return NextResponse.json(
      { error: "Paper chat is available after text extraction completes." },
      { status: 409 }
    );
  }

  const { data: chunkRows, error: chunksError } = await supabase
    .from("paper_chunks")
    .select("id,page_number,chunk_index,text")
    .eq("paper_id", paperId)
    .eq("owner_id", user.id)
    .order("page_number", { ascending: true })
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    return NextResponse.json({ error: chunksError.message }, { status: 500 });
  }

  const chunks = (chunkRows ?? []) as PaperChunkForRetrieval[];
  const shouldUsePaperContext = !isGeneralAssistantMessage(question);
  const selectedChunks = shouldUsePaperContext
    ? selectRelevantChunks(question, chunks)
    : [];
  const contextSources = buildContextSources(selectedChunks);

  try {
    const { data: historyRows, error: historyError } = await supabase
      .from("paper_messages")
      .select(MESSAGE_SELECT)
      .eq("paper_id", paperId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (historyError) throw historyError;

    const recentMessages = ((historyRows ?? []) as Record<string, unknown>[])
      .map(normalizeMessage)
      .reverse();

    const cleanedAnswer = cleanModelAnswer(
      await createGeminiChatCompletion(
        buildModelMessages(paper, question, contextSources, recentMessages)
      )
    );
    const answer = normalizeAnswerCitations(cleanedAnswer, contextSources);

    const userMessage = await insertMessage(supabase, paperId, user.id, "user", question);
    const assistantMessage = await insertMessage(
      supabase,
      paperId,
      user.id,
      "assistant",
      answer.content,
      answer.citations
    );

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error) {
    return NextResponse.json(
      { error: getShortErrorMessage(error) },
      { status: 500 }
    );
  }
}
