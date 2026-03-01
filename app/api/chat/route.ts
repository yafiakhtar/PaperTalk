import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { getOpenAI } from "@/lib/openai";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`chat:${ip}`, 60, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const query = body?.query;
  const documentId = body?.documentId;

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  if (!documentId || typeof documentId !== "string") {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const env = getEnv();
  const openai = getOpenAI();
  const embeddingResponse = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: query
  });

  const queryEmbedding = embeddingResponse.data[0]?.embedding;
  if (!queryEmbedding) {
    return NextResponse.json({ error: "Embedding failed" }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: matches, error } = await supabaseAdmin.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_count: 6,
    filter_document_id: documentId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contextBlocks = (matches ?? []).map((row: any, index: number) => {
    const pageLabel = row.page ? `page ${row.page}` : "page unknown";
    return `Source ${index + 1} (${pageLabel}):\n${row.content}`;
  });

  const systemPrompt = `You are a research assistant. Answer using the provided sources. If the sources do not contain the answer, say so. Include page numbers in brackets like [page 3]. Keep responses concise.`;

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Question: ${query}\n\nSources:\n${contextBlocks.join("\n\n")}`
      }
    ]
  });

  const answer = response.output_text ?? "";
  const citations = (matches ?? []).map((row: any) => ({
    page: row.page ?? null,
    snippet: row.content.slice(0, 320)
  }));

  return NextResponse.json({ answer, citations });
}
