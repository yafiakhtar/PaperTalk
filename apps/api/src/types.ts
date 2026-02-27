export type PageText = {
  pageNumber: number;
  text: string;
};

export type Chunk = {
  chunkId: string;
  pageNumber: number;
  text: string;
  embedding: number[];
};

export type Paper = {
  paperId: string;
  pages: PageText[];
  chunks: Chunk[];
};

export type Citation = {
  page: number;
  snippet: string;
  chunkId: string;
};

export type QueryResponse = {
  transcript: string;
  answer: string;
  citations: Citation[];
  followups: string[];
  audioUrl: string;
};
