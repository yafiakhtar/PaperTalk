export const MESSAGE_SELECT = "id,paper_id,role,content,citations,created_at";

export interface MessageCitation {
  page: number;
  chunkId: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: MessageCitation[];
  created_at?: string;
}

export interface PaperMessage extends Message {
  paper_id: string;
  citations: MessageCitation[];
  created_at: string;
}

export function normalizeMessage(row: Record<string, unknown>): PaperMessage {
  const rawCitations = Array.isArray(row.citations) ? row.citations : [];
  const citations = rawCitations
    .map((citation) => {
      if (!citation || typeof citation !== "object") return null;
      const page = "page" in citation ? Number(citation.page) : NaN;
      const chunkId =
        "chunkId" in citation && typeof citation.chunkId === "string"
          ? citation.chunkId
          : null;

      if (!Number.isInteger(page) || page < 1 || !chunkId) return null;
      return { page, chunkId };
    })
    .filter((citation): citation is MessageCitation => citation !== null);

  return {
    id: String(row.id),
    paper_id: String(row.paper_id),
    role: row.role === "user" ? "user" : "assistant",
    content: String(row.content),
    citations,
    created_at: String(row.created_at)
  };
}
