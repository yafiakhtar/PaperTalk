import { getOpenAI } from "./openai";
import { getEnv } from "./env";

export type Chunk = {
  text: string;
  page: number | null;
  sectionTitle: string | null;
};

export function chunkText(raw: string, maxChars = 3000): Chunk[] {
  const cleaned = raw.replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChars && current.length > 0) {
      chunks.push({ text: current.trim(), page: null, sectionTitle: null });
      current = para;
      continue;
    }
    current = current ? `${current}\n\n${para}` : para;
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), page: null, sectionTitle: null });
  }

  return chunks;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const env = getEnv();
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts
  });
  return response.data.map((item) => item.embedding);
}
