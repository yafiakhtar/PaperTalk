export const PAPERS_BUCKET = "papers";
export const PDF_MIME_TYPE = "application/pdf";
export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
export const PAPER_SELECT =
  "id,title,storage_path,file_size,mime_type,status,extraction_status,extraction_error,extracted_at,page_count,created_at,updated_at";

export type PaperStatus = "uploading" | "ready";
export type PaperExtractionStatus = "pending" | "extracting" | "completed" | "failed";

export interface Paper {
  id: string;
  title: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  status: PaperStatus;
  extraction_status: PaperExtractionStatus;
  extraction_error: string | null;
  extracted_at: string | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
}

export function getPaperStoragePath(userId: string, paperId: string) {
  return `${userId}/${paperId}/original.pdf`;
}

export function getPdfTitleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.pdf$/i, "").trim();
  return withoutExtension || "Untitled paper";
}

export function isPdfFile(file: File) {
  return file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith(".pdf");
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPaperMetadataLabel(paper: Paper) {
  if (paper.status !== "ready") return "Uploading...";

  const fileSize = formatFileSize(paper.file_size);

  if (paper.extraction_status === "completed") {
    return `${fileSize} | Text ready`;
  }

  if (paper.extraction_status === "extracting") {
    return `${fileSize} | Extracting text...`;
  }

  if (paper.extraction_status === "failed") {
    return `${fileSize} | Text extraction failed`;
  }

  return `${fileSize} | Text pending`;
}
