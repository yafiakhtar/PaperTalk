export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: unknown;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
}

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";

function getContentText(content: unknown) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function getOpenRouterUrl() {
  const baseUrl =
    process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL;
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export async function createOpenRouterChatCompletion(messages: OpenRouterMessage[]) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OpenRouter API key is missing. Add OPENROUTER_API_KEY and restart the server.");
  }

  const response = await fetch(getOpenRouterUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "PaperTalk"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 900
    }),
    cache: "no-store"
  });

  const body = (await response.json().catch(() => ({}))) as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || `OpenRouter request failed with status ${response.status}.`
    );
  }

  const content = getContentText(body.choices?.[0]?.message?.content).trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content;
}
