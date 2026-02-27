const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

if (!OPENAI_API_KEY) {
  console.warn("Missing OPENAI_API_KEY env var.");
}

type EmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
};

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${err}`);
  }

  const json = (await res.json()) as EmbeddingResponse;
  return json.data.map((d) => d.embedding);
}

async function rawChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI chat missing content.");
  }
  return content;
}

export type GroundedAnswer = {
  answer: string;
  citations: Array<{ page: number; quote: string }>;
  followups: string[];
};

export async function groundedChat(systemPrompt: string, userPrompt: string): Promise<GroundedAnswer> {
  const content = await rawChat(systemPrompt, userPrompt);
  try {
    const parsed = JSON.parse(content);
    return {
      answer: String(parsed.answer ?? ""),
      citations: Array.isArray(parsed.citations)
        ? parsed.citations.map((c: any) => ({
            page: Number(c.page),
            quote: String(c.quote ?? ""),
          }))
        : [],
      followups: Array.isArray(parsed.followups) ? parsed.followups.map((f: any) => String(f)) : [],
    };
  } catch (err) {
    throw new Error(`Failed to parse OpenAI JSON: ${(err as Error).message}`);
  }
}

export async function jsonChat<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const content = await rawChat(systemPrompt, userPrompt);
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error(`Failed to parse OpenAI JSON: ${(err as Error).message}`);
  }
}
