import type { Paper } from "./types.js";

export const papers = new Map<string, Paper>();

export type AudioFile = {
  id: string;
  path: string;
  mimeType: string;
  createdAt: number;
};

export const audioFiles = new Map<string, AudioFile>();
