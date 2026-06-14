import { NextResponse } from "next/server";
import {
  createGeminiEmbedding,
  formatGeminiRetrievalDocument
} from "@/lib/gemini.server";
import { extractPdfText } from "@/lib/paper-extraction.server";
import type { ExtractedChunk } from "@/lib/paper-extraction.server";
import { PAPER_SELECT, PAPERS_BUCKET, type Paper } from "@/lib/papers";
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

const EMBEDDING_BATCH_SIZE = 4;

function withoutOwnerId(paper: PaperWithOwner): Paper {
  const { owner_id: _ownerId, ...paperWithoutOwner } = paper;
  return paperWithoutOwner;
}

function getShortErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not extract text from this PDF.";

  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

function getWarningMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function buildChunkRows(
  paper: PaperWithOwner,
  paperId: string,
  ownerId: string,
  chunks: ExtractedChunk[]
) {
  const rows: Record<string, unknown>[] = [];
  let shouldAttemptEmbeddings = true;
  let hasLoggedEmbeddingError = false;

  for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
    const embeddings = shouldAttemptEmbeddings
      ? await Promise.all(
          batch.map(async (chunk) => {
            try {
              return await createGeminiEmbedding(
                formatGeminiRetrievalDocument(paper.title, chunk.text)
              );
            } catch (error) {
              shouldAttemptEmbeddings = false;

              if (!hasLoggedEmbeddingError) {
                console.warn(
                  `Paper chunk embedding failed; continuing with keyword fallback. ${getWarningMessage(
                    error
                  )}`
                );
                hasLoggedEmbeddingError = true;
              }

              return null;
            }
          })
        )
      : batch.map(() => null);

    batch.forEach((chunk, batchIndex) => {
      const row: Record<string, unknown> = {
        paper_id: paperId,
        owner_id: ownerId,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        text: chunk.text,
        start_char: chunk.start_char,
        end_char: chunk.end_char
      };

      const embedding = embeddings[batchIndex];
      if (embedding) {
        row.embedding = embedding;
      }

      rows.push(row);
    });
  }

  return rows;
}

async function markExtractionFailed(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  paperId: string,
  message: string
) {
  const { data } = await supabase
    .from("papers")
    .update({
      extraction_status: "failed",
      extraction_error: message,
      extracted_at: null,
      page_count: null
    })
    .eq("id", paperId)
    .select(PAPER_SELECT)
    .single();

  return (data as Paper | null) ?? null;
}

async function insertRowsInBatches(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  table: "paper_pages" | "paper_chunks",
  rows: Record<string, unknown>[]
) {
  const batchSize = 100;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    if (batch.length === 0) continue;

    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { paperId } = await context.params;
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
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

  if (paper.status !== "ready") {
    return NextResponse.json(
      {
        error: "This PDF is not ready for extraction yet.",
        paper: withoutOwnerId(paper)
      },
      { status: 409 }
    );
  }

  if (paper.extraction_status === "completed") {
    return NextResponse.json({ paper: withoutOwnerId(paper) });
  }

  if (
    paper.extraction_status !== "pending" &&
    paper.extraction_status !== "failed"
  ) {
    return NextResponse.json(
      {
        error: "Text extraction is already in progress.",
        paper: withoutOwnerId(paper)
      },
      { status: 409 }
    );
  }

  try {
    const { data: extractingPaper, error: extractingError } = await supabase
      .from("papers")
      .update({
        extraction_status: "extracting",
        extraction_error: null,
        extracted_at: null,
        page_count: null
      })
      .eq("id", paperId)
      .eq("owner_id", user.id)
      .in("extraction_status", ["pending", "failed"])
      .select(`${PAPER_SELECT},owner_id`)
      .maybeSingle();

    if (extractingError) throw extractingError;

    if (!extractingPaper) {
      const { data: currentPaper } = await supabase
        .from("papers")
        .select(`${PAPER_SELECT},owner_id`)
        .eq("id", paperId)
        .eq("owner_id", user.id)
        .maybeSingle();

      return NextResponse.json(
        {
          error: "Text extraction is already in progress.",
          paper: currentPaper
            ? withoutOwnerId(currentPaper as PaperWithOwner)
            : withoutOwnerId(paper)
        },
        { status: 409 }
      );
    }

    const { error: deleteChunksError } = await supabase
      .from("paper_chunks")
      .delete()
      .eq("paper_id", paperId);

    if (deleteChunksError) throw deleteChunksError;

    const { error: deletePagesError } = await supabase
      .from("paper_pages")
      .delete()
      .eq("paper_id", paperId);

    if (deletePagesError) throw deletePagesError;

    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from(PAPERS_BUCKET)
      .download(paper.storage_path);

    if (downloadError || !pdfBlob) {
      throw new Error(downloadError?.message || "Could not download this PDF.");
    }

    const extracted = await extractPdfText(await pdfBlob.arrayBuffer());

    await insertRowsInBatches(
      supabase,
      "paper_pages",
      extracted.pages.map((page) => ({
        paper_id: paperId,
        owner_id: user.id,
        page_number: page.page_number,
        text: page.text,
        char_count: page.char_count
      }))
    );

    await insertRowsInBatches(
      supabase,
      "paper_chunks",
      await buildChunkRows(paper, paperId, user.id, extracted.chunks)
    );

    const { data: updatedPaper, error: updateError } = await supabase
      .from("papers")
      .update({
        extraction_status: "completed",
        extraction_error: null,
        extracted_at: new Date().toISOString(),
        page_count: extracted.pageCount
      })
      .eq("id", paperId)
      .select(PAPER_SELECT)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      paper: updatedPaper as Paper,
      pageCount: extracted.pageCount,
      chunkCount: extracted.chunks.length
    });
  } catch (error) {
    const message = getShortErrorMessage(error);
    await supabase.from("paper_chunks").delete().eq("paper_id", paperId);
    await supabase.from("paper_pages").delete().eq("paper_id", paperId);
    const failedPaper = await markExtractionFailed(supabase, paperId, message);

    return NextResponse.json(
      {
        error: message,
        paper: failedPaper
      },
      { status: message.includes("No selectable text") ? 422 : 500 }
    );
  }
}
