export interface PaperChunkForRetrieval {
  id: string;
  page_number: number;
  chunk_index: number;
  text: string;
}

const MAX_CONTEXT_CHARS = 10000;
const MAX_CONTEXT_CHUNKS = 8;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "been",
  "but",
  "can",
  "could",
  "did",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "its",
  "paper",
  "pdf",
  "that",
  "the",
  "their",
  "there",
  "this",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "would",
  "you"
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9][a-z0-9'-]{2,}/g)
    ?.filter((token) => !STOP_WORDS.has(token)) ?? [];
}

function isBroadPaperQuestion(question: string) {
  const normalizedQuestion = question.toLowerCase().replace(/\s+/g, " ").trim();

  return (
    /\b(summary|summarize|overview|main idea|main point|key point|main topic|abstract|introduction|conclusion|findings|methodology|methods)\b/i.test(
      question
    ) ||
    /\bwhat'?s? (is )?(this |the )?paper about\b/i.test(normalizedQuestion) ||
    /\btell me about (this |the )?paper\b/i.test(normalizedQuestion) ||
    /\bwho (wrote|authored) (this |the )?paper\b/i.test(normalizedQuestion) ||
    /\b(authors?|title) of (this |the )?paper\b/i.test(normalizedQuestion)
  );
}

function countOccurrences(text: string, term: string) {
  let count = 0;
  let index = text.indexOf(term);

  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }

  return count;
}

function scoreChunk(chunk: PaperChunkForRetrieval, terms: string[]) {
  const text = chunk.text.toLowerCase();
  const uniqueTerms = new Set(terms);
  let score = 0;

  uniqueTerms.forEach((term) => {
    const occurrences = countOccurrences(text, term);
    if (occurrences > 0) {
      score += occurrences * (term.length >= 6 ? 2 : 1);
    }
  });

  return score;
}

function capChunks(chunks: PaperChunkForRetrieval[]) {
  const selected: PaperChunkForRetrieval[] = [];
  let charCount = 0;

  for (const chunk of chunks) {
    if (selected.length >= MAX_CONTEXT_CHUNKS) break;
    if (charCount > 0 && charCount + chunk.text.length > MAX_CONTEXT_CHARS) break;

    selected.push(chunk);
    charCount += chunk.text.length;
  }

  return selected.sort((a, b) => a.page_number - b.page_number || a.chunk_index - b.chunk_index);
}

export function selectRelevantChunks(
  question: string,
  chunks: PaperChunkForRetrieval[]
) {
  const terms = tokenize(question);

  if (isBroadPaperQuestion(question)) {
    return capChunks(chunks.slice(0, MAX_CONTEXT_CHUNKS));
  }

  if (terms.length === 0) {
    return [];
  }

  const rankedChunks = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, terms)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.page_number - b.chunk.page_number)
    .map(({ chunk }) => chunk);

  return capChunks(rankedChunks);
}
