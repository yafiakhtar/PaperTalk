import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOpenAI } from "@/lib/openai";
import { getEnv } from "@/lib/env";

const TOP_K = 6;
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`retrieve:${ip}`, 60, 60 * 60 * 1000);
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
  const { data, error } = await supabaseAdmin.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_count: TOP_K,
    filter_document_id: documentId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? []).map((row: any) => ({
    id: row.id,
    page: row.page ?? null,
    text: row.content,
    score: row.similarity,
    snippet: row.content.slice(0, 320)
  }));

  return NextResponse.json({ matches: results });
}
