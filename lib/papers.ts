export const PAPERS_BUCKET = "papers";
export const PDF_MIME_TYPE = "application/pdf";
export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export type PaperStatus = "uploading" | "ready";

export interface Paper {
  id: string;
  title: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  status: PaperStatus;
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
