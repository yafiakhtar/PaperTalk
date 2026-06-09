import { NextResponse } from "next/server";
import { createOpenRouterChatCompletion } from "@/lib/openrouter.server";
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

function uniqueCitations(chunks: PaperChunkForRetrieval[]): MessageCitation[] {
  const seen = new Set<string>();
  const citations: MessageCitation[] = [];

  chunks.forEach((chunk) => {
    if (seen.has(chunk.id)) return;
    seen.add(chunk.id);
    citations.push({
      page: chunk.page_number,
      chunkId: chunk.id
    });
  });

  return citations;
}

function formatContext(chunks: PaperChunkForRetrieval[]) {
  if (chunks.length === 0) {
    return "No relevant paper excerpts were found for this message.";
  }

  return chunks
    .map(
      (chunk, index) =>
        `[Source ${index + 1} | Page ${chunk.page_number}]\n${chunk.text.trim()}`
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

function buildModelMessages(
  paper: PaperWithOwner,
  question: string,
  chunks: PaperChunkForRetrieval[],
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
        "You are PaperTalk, a careful research-paper assistant inside an AI web app. For greetings, small talk, and questions about what you can do, respond naturally and briefly. For paper-specific questions, answer only from the provided paper excerpts. If no relevant excerpts are provided, say you do not see that in the available paper context and suggest a more specific paper question. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, no final citations section, and no source or chunk IDs. Keep the answer to one or two short paragraphs by default. If a page reference is useful, use a brief inline marker like [Page 3]. Do not invent citations, studies, methods, or results."
    },
    ...history,
    {
      role: "user" as const,
      content: `Paper title: ${paper.title}\n\nRelevant paper excerpts:\n${formatContext(
        chunks
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
  const citations = uniqueCitations(selectedChunks);

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

    const answer =
      selectedChunks.length === 0
        ? cleanModelAnswer(
            await createOpenRouterChatCompletion(
              buildModelMessages(paper, question, [], recentMessages)
            )
          )
        : cleanModelAnswer(
            await createOpenRouterChatCompletion(
              buildModelMessages(paper, question, selectedChunks, recentMessages)
            )
          );

    const userMessage = await insertMessage(supabase, paperId, user.id, "user", question);
    const assistantMessage = await insertMessage(
      supabase,
      paperId,
      user.id,
      "assistant",
      answer,
      citations
    );

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error) {
    return NextResponse.json(
      { error: getShortErrorMessage(error) },
      { status: 500 }
    );
  }
}
