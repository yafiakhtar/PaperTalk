import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { papersRouter } from "./papers.js";
import { queryRouter } from "./query.js";
import { audioFiles } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/papers", papersRouter);
app.use("/api/papers", queryRouter);

app.get("/api/audio/:id", (req, res) => {
  const audio = audioFiles.get(req.params.id);
  if (!audio) return res.status(404).end();
  if (!fs.existsSync(audio.path)) return res.status(404).end();
  res.setHeader("Content-Type", audio.mimeType);
  const stream = fs.createReadStream(path.resolve(audio.path));
  stream.pipe(res);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`PaperTalk API listening on ${port}`);
});
