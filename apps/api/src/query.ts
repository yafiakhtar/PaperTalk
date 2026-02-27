import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { papers, audioFiles } from "./store.js";
import { cartesiaSttBatch, cartesiaTtsBytes } from "./cartesia.js";
import { embedTexts, groundedChat, jsonChat } from "./openai.js";
import { cosineSimilarity, topK } from "./vector.js";
import type { Chunk, QueryResponse } from "./types.js";
import { snippetForChunk } from "./papers.js";

const upload = multer();
export const queryRouter = Router();

const SYSTEM_PROMPT = `You are a research assistant. Answer ONLY using the provided excerpts from a paper. 
If the answer is not explicitly supported by the excerpts, say: 
'I cannot find that information in the paper.' 
Always cite page numbers. 
Return valid JSON with:
{
  answer: string,
  citations: [{ page: number, quote: string }],
  followups: string[]
}
Do not include markdown.`;

function buildUserPrompt(chunks: Chunk[], question: string, explainSimple: boolean): string {
  const intro = explainSimple ? "Explain in simple terms.\n\n" : "";
  const context = chunks
    .map((c) => `Page ${c.pageNumber}: ${c.text}`)
    .join("\n\n");
  return `${intro}Question: ${question}\n\nExcerpts:\n${context}`;
}

function pickTopChunks(chunks: Chunk[], queryEmbedding: number[], topKCount = 5) {
  const scored = topK(chunks, topKCount, (chunk) => cosineSimilarity(queryEmbedding, chunk.embedding));
  return scored;
}

function saveAudio(buffer: Buffer, mimeType: string) {
  const id = crypto.randomUUID();
  const ext = mimeType === "audio/mpeg" ? "mp3" : "wav";
  const filePath = path.join("/tmp", `papertalk-tts-${id}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  audioFiles.set(id, { id, path: filePath, mimeType, createdAt: Date.now() });
  return id;
}

queryRouter.post("/:paperId/query", upload.single("audio"), async (req, res) => {
  try {
    const { paperId } = req.params;
    const paper = papers.get(paperId);
    if (!paper) return res.status(404).json({ error: "Paper not found." });
    if (!req.file?.buffer) return res.status(400).json({ error: "Missing audio file." });

    const explainSimple = String(req.body?.explainSimple || "false") === "true";

    const transcript = await cartesiaSttBatch(req.file.buffer, req.file.mimetype);
    if (!transcript) {
      return res.status(500).json({ error: "Failed to transcribe audio." });
    }

    const [queryEmbedding] = await embedTexts([transcript]);
    const scored = pickTopChunks(paper.chunks, queryEmbedding, 5);
    const bestScore = scored[0]?.score ?? 0;

    if (bestScore < 0.2) {
      const refusal = "I cannot find that information in the paper.";
      const tts = await cartesiaTtsBytes(refusal);
      const audioId = saveAudio(tts.buffer, tts.mimeType);
      const response: QueryResponse = {
        transcript,
        answer: refusal,
        citations: [],
        followups: [],
        audioUrl: `/api/audio/${audioId}`,
      };
      return res.json(response);
    }

    const topChunks = scored.map((s) => s.item);
    const userPrompt = buildUserPrompt(topChunks, transcript, explainSimple);

    let grounded;
    try {
      grounded = await groundedChat(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error(err);
      const refusal = "I cannot find that information in the paper.";
      const tts = await cartesiaTtsBytes(refusal);
      const audioId = saveAudio(tts.buffer, tts.mimeType);
      const response: QueryResponse = {
        transcript,
        answer: refusal,
        citations: [],
        followups: [],
        audioUrl: `/api/audio/${audioId}`,
      };
      return res.json(response);
    }

    const citations = grounded.citations.map((c) => {
      const match = topChunks.find((chunk) => chunk.pageNumber === c.page) || topChunks[0];
      return {
        page: Number(c.page),
        snippet: snippetForChunk(match.text),
        chunkId: match.chunkId,
      };
    });

    const answerText = grounded.answer?.trim() || "I cannot find that information in the paper.";
    const tts = await cartesiaTtsBytes(answerText);
    const audioId = saveAudio(tts.buffer, tts.mimeType);

    const response: QueryResponse = {
      transcript,
      answer: answerText,
      citations,
      followups: grounded.followups || [],
      audioUrl: `/api/audio/${audioId}`,
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Query failed." });
  }
});

queryRouter.post("/:paperId/quiz", async (req, res) => {
  try {
    const { paperId } = req.params;
    const paper = papers.get(paperId);
    if (!paper) return res.status(404).json({ error: "Paper not found." });

    const chunks = paper.chunks.slice(0, 10);
    const context = chunks.map((c) => `Page ${c.pageNumber}: ${c.text}`).join("\n\n");

    const system = `You are a research assistant. Using only the provided excerpts, generate 3 quiz questions with short answers. Always cite page numbers. Return valid JSON with { questions: [{ question: string, answer: string, citations: [{ page: number, quote: string }] }] } and no markdown.`;
    const user = `Excerpts:\n${context}`;

    const result = await jsonChat<{ questions: Array<{ question: string; answer: string; citations: Array<{ page: number; quote: string }> }> }>(
      system,
      user
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Quiz failed." });
  }
});
