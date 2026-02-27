const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function uploadPaper(file: File): Promise<{ paperId: string; numPages: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/papers`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPaperPages(paperId: string): Promise<{ pages: { pageNumber: number; text: string }[] }> {
  const res = await fetch(`${API_BASE}/api/papers/${paperId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type QueryResult = {
  transcript: string;
  answer: string;
  citations: { page: number; snippet: string; chunkId: string }[];
  followups: string[];
  audioUrl: string;
};

export async function queryPaper(paperId: string, audioBlob: Blob, explainSimple: boolean): Promise<QueryResult> {
  const form = new FormData();
  form.append("audio", audioBlob, "question.webm");
  form.append("explainSimple", String(explainSimple));
  const res = await fetch(`${API_BASE}/api/papers/${paperId}/query`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function queryPaperText(
  paperId: string,
  text: string,
  explainSimple: boolean
): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/api/papers/${paperId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, explainSimple }),
  });
  if (!res.ok) {
    if (res.status === 501) throw new Error("Text query not available yet.");
    throw new Error(await res.text());
  }
  return res.json();
}

export async function quizPaper(paperId: string) {
  const res = await fetch(`${API_BASE}/api/papers/${paperId}/quiz`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
