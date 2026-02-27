"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPaperPages, queryPaper, queryPaperText, quizPaper, uploadPaper, type QueryResult } from "../lib/api";

type Citation = { page: number; snippet: string; chunkId: string };

const LEFT_TABS = ["Papers", "History"] as const;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pages, setPages] = useState<Array<{ pageNumber: number; text: string }>>([]);
  const [processing, setProcessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [explainSimple, setExplainSimple] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [leftTab, setLeftTab] = useState<(typeof LEFT_TABS)[number]>("Papers");
  const [chatMode, setChatMode] = useState<"type" | "voice">("voice");
  const [textInput, setTextInput] = useState("");
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!paperId || !file) return;
    const url = URL.createObjectURL(file);
    setPdfObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPdfObjectUrl(null);
    };
  }, [paperId, file]);

  useEffect(() => {
    if (!paperId) return;
    fetchPaperPages(paperId)
      .then((data) => setPages(data.pages))
      .catch(() => setPages([]));
  }, [paperId]);

  const handleProcessPaper = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const res = await uploadPaper(file);
      setPaperId(res.paperId);
      setNumPages(res.numPages);
    } catch (err: any) {
      setError(err?.message || "Failed to process paper.");
    } finally {
      setProcessing(false);
    }
  };

  const applyQueryResult = (result: QueryResult) => {
    setTranscript(result.transcript);
    setAnswer(result.answer);
    setCitations(result.citations || []);
    setFollowups(result.followups || []);
    setAudioUrl(result.audioUrl || "");
  };

  const startRecording = async () => {
    if (!paperId) return;
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      try {
        const result = await queryPaper(paperId, audioBlob, explainSimple);
        applyQueryResult(result);
      } catch (err: any) {
        setError(err?.message || "Query failed.");
      }
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleTextQuery = async () => {
    const trimmed = textInput.trim();
    if (!paperId || !trimmed) return;
    setProcessing(true);
    setError("");
    try {
      const result = await queryPaperText(paperId, trimmed, explainSimple);
      applyQueryResult(result);
      setTextInput("");
    } catch (err: any) {
      setError(err?.message || "Query failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleQuiz = async () => {
    if (!paperId) return;
    setProcessing(true);
    setError("");
    try {
      const data = await quizPaper(paperId);
      setQuiz(data);
    } catch (err: any) {
      setError(err?.message || "Quiz failed.");
    } finally {
      setProcessing(false);
    }
  };

  const highlightSnippet = (text: string, snippets: string[]) => {
    let highlighted = text;
    snippets.forEach((snippet) => {
      if (!snippet) return;
      const escaped = snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "gi");
      highlighted = highlighted.replace(regex, (match) => `<<mark>>${match}<</mark>>`);
    });
    return highlighted.split("<<mark>>").flatMap((part, idx) => {
      const [before, after] = part.split("<</mark>>");
      if (after === undefined) return [<span key={`${idx}-plain`}>{before}</span>];
      return [
        <mark key={`${idx}-mark`} className="bg-ink/10 rounded px-0.5">{before}</mark>,
        <span key={`${idx}-after`}>{after}</span>,
      ];
    });
  };

  const snippetsByPage = citations.reduce<Record<number, string[]>>((acc, c) => {
    acc[c.page] = acc[c.page] || [];
    acc[c.page].push(c.snippet);
    return acc;
  }, {});

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col lg:flex-row">
      {/* Column 1: Minimal strip (tabs) */}
      <aside className="flex shrink-0 flex-row border-b border-border bg-surface py-2 px-3 gap-4 lg:w-16 lg:flex-col lg:border-b-0 lg:border-r lg:py-4 lg:px-0 lg:items-center lg:gap-2">
        {LEFT_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setLeftTab(tab)}
            className={`text-xs font-medium tracking-wide text-ink/70 hover:text-ink ${
              leftTab === tab ? "text-ink border-ink lg:border-l-2 lg:pl-1 lg:-ml-px border-b-2 lg:border-b-0 pb-1 lg:pb-0" : ""
            }`}
          >
            {tab}
          </button>
        ))}
      </aside>

      {/* Column 2: PDF viewer or landing */}
      <section className="flex min-w-0 flex-1 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
        {!paperId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
            <p className="font-display text-center text-xl text-ink">Talk to research papers.</p>
            <p className="text-center text-sm text-ink/60 max-w-sm">
              Upload a PDF, then ask questions by voice or text. Answers are grounded in your paper.
            </p>
            <div className="flex w-full max-w-md flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink/70">PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="rounded border border-border bg-white px-3 py-2 text-sm text-ink file:mr-2 file:rounded file:border-0 file:bg-ink/5 file:px-3 file:py-1 file:text-xs file:text-ink"
                />
              </label>
              <button
                onClick={handleProcessPaper}
                disabled={!file || processing}
                className="rounded border border-ink bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {processing ? "Processing…" : "Process paper"}
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="border-b border-border px-3 py-2 text-xs text-ink/60">
              {paperId} · {numPages} pages
            </div>
            <div className="flex-1 min-h-0 p-2">
              {pdfObjectUrl ? (
                <iframe
                  src={pdfObjectUrl}
                  title="PDF"
                  className="h-full w-full rounded border border-border bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink/50">Loading PDF…</div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Column 3: Chat (Type / Voice tabs) */}
      <section className="flex w-full shrink-0 flex-col border-border bg-surface lg:max-w-md">
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex border-b border-border">
            <button
              onClick={() => setChatMode("type")}
              className={`flex-1 py-3 text-center text-xs font-medium ${
                chatMode === "type" ? "border-b-2 border-ink text-ink" : "text-ink/60 hover:text-ink"
              }`}
            >
              Type
            </button>
            <button
              onClick={() => setChatMode("voice")}
              className={`flex-1 py-3 text-center text-xs font-medium ${
                chatMode === "voice" ? "border-b-2 border-ink text-ink" : "text-ink/60 hover:text-ink"
              }`}
            >
              Voice
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input
                type="checkbox"
                checked={explainSimple}
                onChange={(e) => setExplainSimple(e.target.checked)}
                className="rounded border-border"
              />
              Explain simply
            </label>

            {chatMode === "type" ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleTextQuery();
                    }
                  }}
                  placeholder="Ask about the paper…"
                  rows={3}
                  className="w-full resize-none rounded border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40"
                  disabled={!paperId || processing}
                />
                <button
                  onClick={handleTextQuery}
                  disabled={!paperId || !textInput.trim() || processing}
                  className="self-end rounded border border-ink bg-ink px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={!paperId || recording}
                  className={`rounded border px-4 py-2 text-xs font-medium disabled:opacity-40 ${
                    recording ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
                  }`}
                >
                  {recording ? "Recording…" : "Hold to talk"}
                </button>
                <button
                  onClick={handleQuiz}
                  disabled={!paperId || processing}
                  className="rounded border border-border bg-white px-4 py-2 text-xs font-medium text-ink disabled:opacity-40"
                >
                  Quiz me
                </button>
              </div>
            )}

            {transcript && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-ink/50">Transcript</p>
                <p className="text-sm text-ink/80">{transcript}</p>
              </div>
            )}

            {answer && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-ink/50">Answer</p>
                <p className="text-sm leading-relaxed text-ink">{answer}</p>
                {audioUrl && <audio controls src={audioUrl} className="mt-2 w-full max-w-full" />}
              </div>
            )}

            {citations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-ink/50">Citations</p>
                <ul className="space-y-1.5">
                  {citations.map((c) => (
                    <li key={c.chunkId} className="text-xs text-ink/70">
                      <span className="font-medium text-ink">Page {c.page}:</span> {c.snippet}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {followups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-ink/50">Follow-ups</p>
                <ul className="space-y-1">
                  {followups.map((f, idx) => (
                    <li key={idx} className="text-xs text-ink/70">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {quiz?.questions && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-ink/50">Quiz</p>
                <ul className="space-y-3">
                  {quiz.questions.map((q: any, idx: number) => (
                    <li key={idx} className="rounded border border-border bg-white p-3">
                      <p className="text-sm font-medium text-ink">{q.question}</p>
                      <p className="mt-1 text-xs text-ink/70">{q.answer}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        {/* Cited passages (collapsed list) */}
        {pages.length > 0 && (
          <details className="border-t border-border">
            <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-ink/70 hover:text-ink">
              Cited passages
            </summary>
            <div className="max-h-48 overflow-auto space-y-3 px-4 pb-4">
              {pages.map((page) => (
                <div key={page.pageNumber} className="rounded border border-border bg-white p-3">
                  <p className="text-xs text-ink/50">Page {page.pageNumber}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink/80">
                    {highlightSnippet(page.text, snippetsByPage[page.pageNumber] || [])}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
