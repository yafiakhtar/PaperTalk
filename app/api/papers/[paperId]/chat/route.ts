import { NextResponse } from "next/server";
import {
  createGeminiChatCompletion,
  createGeminiEmbedding,
  formatGeminiQuestionAnsweringQuery
} from "@/lib/gemini.server";
import { PAPER_SELECT, type Paper } from "@/lib/papers";
import {
  MAX_CONTEXT_CHUNKS,
  isBackgroundConceptQuestion,
  isBroadPaperQuestion,
  isLearningGuidanceQuestion,
  isPaperHelpRequest,
  selectCombinedChunks,
  selectOpeningChunks,
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

type ServerSupabaseClient = Awaited<ReturnType<typeof getServerSupabaseClient>>;

type QuestionMode =
  | "general"
  | "tutor_confusion"
  | "background_explanation"
  | "learning_guidance"
  | "paper_fact";

interface PaperChunkMatchRow extends PaperChunkForRetrieval {
  similarity?: number | null;
}

const LEARNING_GUIDANCE_OPENING_CHUNKS = 3;
const TUTOR_CONTEXT_CHUNKS = 4;
const BACKGROUND_CONTEXT_CHUNKS = 4;

function getShortErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not answer this question.";
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

function getWarningMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
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

function getQuestionMode(question: string): QuestionMode {
  if (isGeneralAssistantMessage(question)) return "general";
  if (isPaperHelpRequest(question)) return "tutor_confusion";
  if (isBackgroundConceptQuestion(question)) return "background_explanation";
  if (isLearningGuidanceQuestion(question)) return "learning_guidance";
  return "paper_fact";
}

async function fetchAllPaperChunks(
  supabase: ServerSupabaseClient,
  paperId: string,
  ownerId: string
) {
  const { data, error } = await supabase
    .from("paper_chunks")
    .select("id,page_number,chunk_index,text")
    .eq("paper_id", paperId)
    .eq("owner_id", ownerId)
    .order("page_number", { ascending: true })
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaperChunkForRetrieval[];
}

async function matchSemanticPaperChunks(
  supabase: ServerSupabaseClient,
  paperId: string,
  question: string,
  matchCount = MAX_CONTEXT_CHUNKS
) {
  try {
    const queryEmbedding = await createGeminiEmbedding(
      formatGeminiQuestionAnsweringQuery(question)
    );
    const { data, error } = await supabase.rpc("match_paper_chunks", {
      match_paper_id: paperId,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: 0
    });

    if (error) {
      console.warn(
        `Paper vector retrieval failed; falling back to keyword retrieval. ${error.message}`
      );
      return [];
    }

    return ((data ?? []) as PaperChunkMatchRow[]).map((chunk) => ({
      id: chunk.id,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      text: chunk.text
    }));
  } catch (error) {
    console.warn(
      `Paper query embedding failed; falling back to keyword retrieval. ${getWarningMessage(
        error
      )}`
    );
    return [];
  }
}

async function selectChunksForQuestion(
  supabase: ServerSupabaseClient,
  paperId: string,
  ownerId: string,
  question: string,
  questionMode: Exclude<QuestionMode, "general">
) {
  const allChunks =
    questionMode === "learning_guidance" ||
    questionMode === "tutor_confusion" ||
    questionMode === "background_explanation" ||
    isBroadPaperQuestion(question)
      ? await fetchAllPaperChunks(supabase, paperId, ownerId)
      : null;

  if (questionMode === "background_explanation") {
    const semanticChunks = await matchSemanticPaperChunks(
      supabase,
      paperId,
      question,
      BACKGROUND_CONTEXT_CHUNKS
    );
    const keywordChunks = selectRelevantChunks(
      question,
      allChunks ?? [],
      BACKGROUND_CONTEXT_CHUNKS
    );
    const topicChunks = selectCombinedChunks(
      [semanticChunks, keywordChunks],
      BACKGROUND_CONTEXT_CHUNKS
    );

    if (topicChunks.length > 0) {
      return topicChunks;
    }

    return selectOpeningChunks(allChunks ?? [], Math.min(2, BACKGROUND_CONTEXT_CHUNKS));
  }

  if (questionMode === "tutor_confusion") {
    const semanticChunks = await matchSemanticPaperChunks(
      supabase,
      paperId,
      question,
      TUTOR_CONTEXT_CHUNKS
    );
    const keywordChunks = selectRelevantChunks(
      question,
      allChunks ?? [],
      TUTOR_CONTEXT_CHUNKS
    );
    const topicChunks = selectCombinedChunks(
      [semanticChunks, keywordChunks],
      TUTOR_CONTEXT_CHUNKS
    );

    if (topicChunks.length > 0) {
      return topicChunks;
    }

    return selectOpeningChunks(allChunks ?? [], Math.min(2, TUTOR_CONTEXT_CHUNKS));
  }

  if (questionMode === "learning_guidance") {
    const openingChunks = (allChunks ?? []).slice(0, LEARNING_GUIDANCE_OPENING_CHUNKS);
    const semanticChunks = await matchSemanticPaperChunks(supabase, paperId, question);
    const keywordChunks = selectRelevantChunks(question, allChunks ?? []);

    return selectCombinedChunks([openingChunks, semanticChunks, keywordChunks]);
  }

  if (isBroadPaperQuestion(question)) {
    return selectOpeningChunks(allChunks ?? []);
  }

  const semanticChunks = await matchSemanticPaperChunks(supabase, paperId, question);
  if (semanticChunks.length > 0) {
    return semanticChunks;
  }

  return selectRelevantChunks(
    question,
    await fetchAllPaperChunks(supabase, paperId, ownerId)
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
        `[Page ${source.chunk.page_number}]\n${source.chunk.text.trim()}`
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
    .replace(/\bSource\s+\d+\b/gi, "the paper excerpt")
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
  questionMode: QuestionMode,
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
      content: getSystemPrompt(questionMode)
    },
    ...history,
    {
      role: "user" as const,
      content:
        questionMode === "general"
          ? question
          : `Paper title: ${paper.title}\n\nRelevant paper excerpts:\n${formatContext(
              sources
            )}\n\nQuestion: ${question}`
    }
  ];
}

function getSystemPrompt(questionMode: QuestionMode) {
  if (questionMode === "general") {
    return "You are PaperTalk, a careful research-paper assistant inside an AI web app. For greetings, small talk, and questions about what you can do, respond naturally and briefly. Do not cite sources for general chat. Write in clean plain text: no Markdown, no bold, no headings, and no final citations section.";
  }

  if (questionMode === "learning_guidance") {
    return "You are PaperTalk, a careful research-paper assistant inside an AI web app. The user is asking for learning guidance, reading strategy, prerequisites, or whether this paper is suitable for them. You may give general educational advice about how to approach the paper, but clearly distinguish that advice from what the provided excerpts show. Use the excerpts to identify what the paper is about. For paper-specific details, use brief page markers when useful, like [Page 7]. Do not mention source IDs or chunk IDs. Do not cite general study advice. If the excerpts are weak or missing, say that the available paper context is limited, but still offer cautious general reading advice when useful. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, and no final citations section. Keep the answer to one or two short paragraphs by default. Do not invent paper details.";
  }

  if (questionMode === "background_explanation") {
    return "You are PaperTalk, a careful research-paper tutor inside an AI web app. The user is asking for background understanding of a concept or term. First state any relevant fact from the provided paper excerpts with a brief page marker when useful, like [Page 7]. Then explain the concept using stable educational background knowledge. Make it clear what comes from the paper and what is general background. Keep it beginner-friendly and connect the explanation back to why the term matters in this paper. Do not use web search. Do not mention source IDs or chunk IDs. Do not refuse just because the paper does not define the term. Do not make current, pricing, newer-paper, or post-paper claims. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, and no final citations section. Keep the answer to one or two short paragraphs by default.";
  }

  if (questionMode === "tutor_confusion") {
    return "You are PaperTalk, a careful research-paper tutor inside an AI web app. The user is signaling confusion or asking for help understanding part of the paper. For vague help or confusion messages, do not dump a full factual summary. Acknowledge the confusion, briefly map the relevant section into 3 to 5 understandable subtopics, then ask one clarifying question about what they want to unpack. If the user asks whether they can go over doubts, questions, or a section with you, say yes warmly, give a short roadmap of likely subtopics, and ask which one they want to start with. Do not respond with generic limitations like \"I can only provide factual information based on the excerpts\" unless the user asks for something outside the paper. For specific explain or walkthrough requests, explain slowly and briefly at a beginner-friendly level instead of asking another clarifying question. Use paper details only as needed. For paper-specific details, use brief page markers when useful, like [Page 7]. Do not mention source IDs or chunk IDs. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, and no final citations section. Keep the answer short by default. Do not invent paper details.";
  }

  return "You are PaperTalk, a careful research-paper assistant inside an AI web app. For factual questions about the paper, answer only from the provided paper excerpts. If no relevant excerpts are provided, say you do not see that in the available paper context and suggest a more specific paper question. For paper-specific factual claims, use brief page markers when useful, like [Page 7]. Do not mention source IDs or chunk IDs. Do not cite greetings, small talk, or missing-context responses. Write in clean plain text: no Markdown, no bullets unless the user asks, no bold, no headings, and no final citations section. Keep the answer to one or two short paragraphs by default. Do not invent citations, studies, methods, or results.";
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

  const questionMode = getQuestionMode(question);
  const shouldUsePaperContext = questionMode !== "general";
  let selectedChunks: PaperChunkForRetrieval[] = [];

  if (shouldUsePaperContext) {
    try {
      selectedChunks = await selectChunksForQuestion(
        supabase,
        paperId,
        user.id,
        question,
        questionMode
      );
    } catch (error) {
      return NextResponse.json(
        { error: getShortErrorMessage(error) },
        { status: 500 }
      );
    }
  }

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
        buildModelMessages(paper, question, questionMode, contextSources, recentMessages)
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
