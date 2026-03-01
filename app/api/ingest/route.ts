import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchBlob } from "@/lib/blob";
import { parsePdf, isLikelyScanned } from "@/lib/pdf";
import { extractTextWithOpenAI } from "@/lib/ocr";
import { chunkText, embedTexts } from "@/lib/rag";
import { splitPagesByFormFeed, splitPagesByMarker } from "@/lib/page-split";

const MAX_CHUNKS = 400;
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`ingest:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const documentId = body?.documentId;
  if (!documentId || typeof documentId !== "string") {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: document, error } = await supabaseAdmin
    .from("documents")
    .select("id, blob_url, status")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabaseAdmin.from("documents").update({ status: "processing" }).eq("id", documentId);

  const buffer = await fetchBlob(document.blob_url);
  const parsed = await parsePdf(buffer);
  let text = parsed.text;
  let pageCount = parsed.pageCount;

  if (isLikelyScanned(text, pageCount)) {
    text = await extractTextWithOpenAI(buffer);
  }

  const pagesByMarker = splitPagesByMarker(text);
  const pagesByFormFeed = splitPagesByFormFeed(text);
  const pages = pagesByMarker ?? pagesByFormFeed;

  const chunkEntries: { text: string; page: number | null }[] = [];

  if (pages && pages.length > 0) {
    pageCount = Math.max(pageCount, pages.length);
    for (const page of pages) {
      const chunks = chunkText(page.text);
      for (const chunk of chunks) {
        chunkEntries.push({ text: chunk.text, page: page.page });
      }
    }
  } else {
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      chunkEntries.push({ text: chunk.text, page: null });
    }
  }

  const limited = chunkEntries.slice(0, MAX_CHUNKS);
  const embeddings = await embedTexts(limited.map((chunk) => chunk.text));

  await supabaseAdmin.from("chunks").delete().eq("document_id", documentId);

  const rows = limited.map((chunk, index) => ({
    document_id: documentId,
    content: chunk.text,
    embedding: embeddings[index],
    page: chunk.page,
    section_title: null
  }));

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error: insertError } = await supabaseAdmin.from("chunks").insert(batch);
    if (insertError) {
      await supabaseAdmin.from("documents").update({ status: "failed" }).eq("id", documentId);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  await supabaseAdmin
    .from("documents")
    .update({ status: "ready", page_count: pageCount })
    .eq("id", documentId);

  return NextResponse.json({ ok: true, chunks: rows.length });
}
