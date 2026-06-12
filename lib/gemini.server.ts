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

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";

function getGeminiModel() {
  return (
    process.env.GEMINI_CHAT_MODEL?.trim().replace(/^models\//, "") ||
    DEFAULT_GEMINI_CHAT_MODEL
  );
}

function getGeminiUrl() {
  return `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
    getGeminiModel()
  )}:generateContent`;
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

export async function createGeminiChatCompletion(messages: GeminiMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Gemini API key is missing. Add GEMINI_API_KEY and restart the server.");
  }

  const response = await fetch(getGeminiUrl(), {
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
