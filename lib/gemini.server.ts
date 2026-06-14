export interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GeminiResponsePart {
  text?: unknown;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiEmbedding {
  values?: unknown;
}

interface GeminiEmbeddingResponse {
  embedding?: GeminiEmbedding;
  embeddings?: GeminiEmbedding[];
  error?: {
    message?: string;
  };
}

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
const DEFAULT_GEMINI_EMBEDDING_DIMENSIONS = 768;

function getGeminiModelName(value: string | undefined, fallback: string) {
  return value?.trim().replace(/^models\//, "") || fallback;
}

function getGeminiChatModel() {
  return (
    getGeminiModelName(process.env.GEMINI_CHAT_MODEL, DEFAULT_GEMINI_CHAT_MODEL)
  );
}

function getGeminiEmbeddingModel() {
  return getGeminiModelName(
    process.env.GEMINI_EMBEDDING_MODEL,
    DEFAULT_GEMINI_EMBEDDING_MODEL
  );
}

function getGeminiEmbeddingDimensions() {
  const configuredDimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS);

  if (!process.env.GEMINI_EMBEDDING_DIMENSIONS) {
    return DEFAULT_GEMINI_EMBEDDING_DIMENSIONS;
  }

  if (
    Number.isInteger(configuredDimensions) &&
    configuredDimensions === DEFAULT_GEMINI_EMBEDDING_DIMENSIONS
  ) {
    return configuredDimensions;
  }

  throw new Error(
    `GEMINI_EMBEDDING_DIMENSIONS must be ${DEFAULT_GEMINI_EMBEDDING_DIMENSIONS} to match the database vector column.`
  );
}

function getGeminiGenerateUrl() {
  return `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
    getGeminiChatModel()
  )}:generateContent`;
}

function getGeminiEmbeddingUrl() {
  return `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
    getGeminiEmbeddingModel()
  )}:embedContent`;
}

function getContentText(parts: GeminiResponsePart[] | undefined) {
  return (
    parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function buildGeminiRequestBody(messages: GeminiMessage[]) {
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));

  return {
    ...(systemText
      ? {
          systemInstruction: {
            parts: [{ text: systemText }]
          }
        }
      : {}),
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 900
    }
  };
}

function getRawEmbeddingValues(body: GeminiEmbeddingResponse): unknown[] {
  if (Array.isArray(body.embedding?.values)) {
    return body.embedding.values;
  }

  const embedding = body.embeddings?.find((item) => Array.isArray(item.values));
  return Array.isArray(embedding?.values) ? embedding.values : [];
}

function getEmbeddingValues(body: GeminiEmbeddingResponse) {
  return getRawEmbeddingValues(body)
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => Number.isFinite(value));
}

function assertEmbeddingDimensions(embedding: number[]) {
  const dimensions = getGeminiEmbeddingDimensions();

  if (embedding.length !== dimensions) {
    throw new Error(
      `Gemini returned ${embedding.length} embedding dimensions, expected ${dimensions}.`
    );
  }
}

export function formatGeminiRetrievalDocument(title: string, text: string) {
  const normalizedTitle = title.trim() || "none";
  return `title: ${normalizedTitle} | text: ${text}`;
}

export function formatGeminiQuestionAnsweringQuery(question: string) {
  return `task: question answering | query: ${question}`;
}

export async function createGeminiChatCompletion(messages: GeminiMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Gemini API key is missing. Add GEMINI_API_KEY and restart the server.");
  }

  const response = await fetch(getGeminiGenerateUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(buildGeminiRequestBody(messages)),
    cache: "no-store"
  });

  const body = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || `Gemini request failed with status ${response.status}.`
    );
  }

  const content = getContentText(body.candidates?.[0]?.content?.parts);

  if (!content) {
    const finishReason = body.candidates?.[0]?.finishReason;
    const blockReason = body.promptFeedback?.blockReason;
    const reason = finishReason || blockReason;

    throw new Error(
      reason
        ? `Gemini returned an empty response. Reason: ${reason}.`
        : "Gemini returned an empty response."
    );
  }

  return content;
}

export async function createGeminiEmbedding(text: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Gemini API key is missing. Add GEMINI_API_KEY and restart the server.");
  }

  const model = getGeminiEmbeddingModel();
  const response = await fetch(getGeminiEmbeddingUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: `models/${model}`,
      content: {
        parts: [{ text }]
      },
      output_dimensionality: getGeminiEmbeddingDimensions()
    }),
    cache: "no-store"
  });

  const body = (await response.json().catch(() => ({}))) as GeminiEmbeddingResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || `Gemini embedding request failed with status ${response.status}.`
    );
  }

  const embedding = getEmbeddingValues(body);
  assertEmbeddingDimensions(embedding);

  return embedding;
}
