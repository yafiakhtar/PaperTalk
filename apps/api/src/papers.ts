import { Router } from "express";
import multer from "multer";
import pdf from "pdf-parse";
import crypto from "crypto";
import { embedTexts } from "./openai.js";
import { papers } from "./store.js";
import type { Chunk, PageText, Paper } from "./types.js";

const upload = multer();
export const papersRouter = Router();

function chunkPageText(pageText: string, pageNumber: number): Array<Omit<Chunk, "embedding">> {
  const minSize = 500;
  const maxSize = 900;
  const overlap = 100;

  const chunks: Array<Omit<Chunk, "embedding">> = [];
  let start = 0;
  while (start < pageText.length) {
    const size = Math.min(maxSize, pageText.length - start);
    const slice = pageText.slice(start, start + size);
    if (slice.trim().length >= minSize || start + size >= pageText.length) {
      chunks.push({
        chunkId: crypto.randomUUID(),
        pageNumber,
        text: slice.trim(),
      });
    }
    start += size - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

function limitSnippet(text: string, maxLen = 240): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

async function extractPages(pdfBuffer: Buffer): Promise<PageText[]> {
  const pages: PageText[] = [];

  await pdf(pdfBuffer, {
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items.map((item: any) => item.str);
      const text = strings.join(" ");
      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text,
      });
      return "";
    },
  });

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return pages;
}

papersRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Missing PDF file." });
    }

    const paperId = crypto.randomUUID();
    const pages = await extractPages(req.file.buffer);

    const chunkDrafts = pages.flatMap((page) => chunkPageText(page.text, page.pageNumber));
    const embeddings = await embedTexts(chunkDrafts.map((c) => c.text));

    const chunks: Chunk[] = chunkDrafts.map((c, idx) => ({
      ...c,
      text: c.text,
      embedding: embeddings[idx],
    }));

    const paper: Paper = { paperId, pages, chunks };
    papers.set(paperId, paper);

    return res.json({ paperId, numPages: pages.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process PDF." });
  }
});

papersRouter.get("/:paperId", (req, res) => {
  const paper = papers.get(req.params.paperId);
  if (!paper) return res.status(404).json({ error: "Paper not found." });
  return res.json({ pages: paper.pages });
});

export function snippetForChunk(chunkText: string): string {
  return limitSnippet(chunkText);
}
