import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

type PdfJsWorkerGlobal = typeof globalThis & {
  pdfjsWorker?: typeof pdfjsWorker;
};

(globalThis as PdfJsWorkerGlobal).pdfjsWorker = pdfjsWorker;

const CHUNK_TARGET_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 200;
const MIN_BOUNDARY_RATIO = 0.6;

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
}

export interface ExtractedPage {
  page_number: number;
  text: string;
  char_count: number;
}

export interface ExtractedChunk {
  page_number: number;
  chunk_index: number;
  text: string;
  start_char: number;
  end_char: number;
}

export interface ExtractedPdfText {
  pageCount: number;
  pages: ExtractedPage[];
  chunks: ExtractedChunk[];
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string"
  );
}

function normalizeExtractedPageText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u00AD/g, "")
    .replace(/(\p{L})-\s*[\r\n]+\s*(\p{L})/gu, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getLastMatchEnd(text: string, pattern: RegExp) {
  let lastMatchEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    lastMatchEnd = match.index + match[0].length;
  }

  return lastMatchEnd;
}

function findChunkEnd(text: string, start: number, idealEnd: number) {
  if (idealEnd >= text.length) return text.length;

  const minimumEnd = Math.min(
    idealEnd,
    start + Math.floor(CHUNK_TARGET_CHARS * MIN_BOUNDARY_RATIO)
  );
  const searchWindow = text.slice(minimumEnd, idealEnd);
  const boundaryPatterns = [
    /\n\s*\n/g,
    /[.!?]["')\]]?\s+/g,
    /\n/g,
    /;\s+/g,
    /,\s+/g,
    /\s+/g
  ];

  for (const pattern of boundaryPatterns) {
    const boundaryEnd = getLastMatchEnd(searchWindow, pattern);
    if (boundaryEnd > -1) return minimumEnd + boundaryEnd;
  }

  return idealEnd;
}

function trimChunkRange(text: string, start: number, end: number) {
  const rawChunk = text.slice(start, end);
  const leadingWhitespace = rawChunk.match(/^\s*/)?.[0].length ?? 0;
  const trailingWhitespace = rawChunk.match(/\s*$/)?.[0].length ?? 0;

  return {
    start: start + leadingWhitespace,
    end: Math.max(start + leadingWhitespace, end - trailingWhitespace)
  };
}

function skipLeadingWhitespace(text: string, start: number) {
  let nextStart = start;

  while (nextStart < text.length && /\s/.test(text[nextStart])) {
    nextStart += 1;
  }

  return nextStart;
}

function chunkPageText(pageNumber: number, pageText: string) {
  const chunks: ExtractedChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < pageText.length) {
    const idealEnd = Math.min(start + CHUNK_TARGET_CHARS, pageText.length);
    const end = Math.max(start + 1, findChunkEnd(pageText, start, idealEnd));
    const trimmedRange = trimChunkRange(pageText, start, end);

    if (trimmedRange.end > trimmedRange.start) {
      chunks.push({
        page_number: pageNumber,
        chunk_index: chunkIndex,
        text: pageText.slice(trimmedRange.start, trimmedRange.end),
        start_char: trimmedRange.start,
        end_char: trimmedRange.end
      });
      chunkIndex += 1;
    }

    if (end >= pageText.length) break;

    start = skipLeadingWhitespace(
      pageText,
      Math.max(start + 1, end - CHUNK_OVERLAP_CHARS)
    );
  }

  return chunks;
}

function textContentItemsToPageText(items: unknown[]) {
  let pageText = "";

  for (const item of items) {
    if (!isPdfTextItem(item)) continue;

    pageText += item.str;

    if (item.hasEOL) {
      pageText += "\n";
    }
  }

  return normalizeExtractedPageText(pageText);
}

export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<ExtractedPdfText> {
  const loadingTask = getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true
  });
  const pdfDocument = await loadingTask.promise;

  try {
    const pages: ExtractedPage[] = [];
    const chunks: ExtractedChunk[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContentItemsToPageText(textContent.items);

      pages.push({
        page_number: pageNumber,
        text: pageText,
        char_count: pageText.length
      });
      chunks.push(...chunkPageText(pageNumber, pageText));
      page.cleanup();
    }

    if (pages.every((page) => page.text.length === 0)) {
      throw new Error("No selectable text was found in this PDF.");
    }

    return {
      pageCount: pdfDocument.numPages,
      pages,
      chunks
    };
  } finally {
    await pdfDocument.cleanup();
    await loadingTask.destroy();
  }
}
