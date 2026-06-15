export interface PaperChunkForRetrieval {
  id: string;
  page_number: number;
  chunk_index: number;
  text: string;
}

const MAX_CONTEXT_CHARS = 10000;
export const MAX_CONTEXT_CHUNKS = 8;

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

export function isBroadPaperQuestion(question: string) {
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

export function isLearningGuidanceQuestion(question: string) {
  const normalizedQuestion = question
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /\b(beginner|beginners|new to|starting out|just starting|getting into|get into|first paper|starting point|good (paper|way|place)|worth reading|should i read|prerequisites?|background needed|prior knowledge|reading strategy|reading plan)\b/i.test(
      normalizedQuestion
    ) ||
    /\bhow should i (approach|read|study|learn)\b/i.test(normalizedQuestion) ||
    /\bis (this|the) paper (hard|difficult|challenging|too advanced)\b/i.test(
      normalizedQuestion
    ) ||
    /\b(starting|started|new)\b.*\b(ml|ai|machine learning|artificial intelligence|paper|field)\b/i.test(
      normalizedQuestion
    )
  );
}

export function isPaperHelpRequest(question: string) {
  const normalizedQuestion = question
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /\b(i\s+have|i\s+had|got|have)\s+(a\s+couple\s+of\s+)?(doubts?|questions?|confusion)\b/i.test(
      normalizedQuestion
    ) ||
    /\b(i'?m|i am)\s+(confused|stuck|lost)\b/i.test(normalizedQuestion) ||
    /\b(don'?t|do not)\s+understand\b/i.test(normalizedQuestion) ||
    /\bhelp me understand\b/i.test(normalizedQuestion) ||
    /\b(can you|could you)\s+(explain|walk me through|help)\b/i.test(
      normalizedQuestion
    ) ||
    /\b(can|could)\s+i\s+(go over|ask|talk through|discuss|walk through)\b/i.test(
      normalizedQuestion
    ) ||
    /\b(can|could)\s+we\s+(go over|talk through|discuss|walk through)\b/i.test(
      normalizedQuestion
    ) ||
    /\bgo over (them|this|it) with you\b/i.test(normalizedQuestion) ||
    /\bquestions? about .*\b(can|could)\s+i\b/i.test(normalizedQuestion) ||
    /\b(section|part|chapter|paragraph|training|attention|optimizer|architecture|loss function|method)\s+(is|was|feels?)\s+(confusing|hard|difficult|unclear)\b/i.test(
      normalizedQuestion
    )
  );
}

export function isBackgroundConceptQuestion(question: string) {
  if (isBroadPaperQuestion(question)) {
    return false;
  }

  const normalizedQuestion = question
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const asksExplicitMeaning =
    /\bwhat\s+(?:does|do)\s+.+\s+mean\b/i.test(normalizedQuestion) ||
    /\bwhat\s+(?:does|do)\s+.+\s+stand\s+for\b/i.test(normalizedQuestion) ||
    /\bwhat\s+.+\s+means?\b/i.test(normalizedQuestion) ||
    /\bdefine\s+.+\b/i.test(normalizedQuestion);

  const asksConceptDefinition =
    /\bwhat\s+(?:exactly\s+)?(?:is|are)\s+.+\b/i.test(normalizedQuestion) ||
    /\bwhat'?s\s+.+\b/i.test(normalizedQuestion) ||
    /\bexplain\s+.+\b/i.test(normalizedQuestion) ||
    asksExplicitMeaning;

  const asksPaperFact =
    /\b(what|which|how|why)\b.*\b(use|used|introduce|introduced|propose|proposed|show|shown|report|reported|train on|trained on|evaluate|evaluated|compare|compared|achieve|achieved)\b/i.test(
      normalizedQuestion
    ) ||
    /\b(the|this)?\s*paper\s+(say|says|state|states|claim|claims|use|uses|used|introduce|introduced|propose|proposed|show|shows|report|reports|evaluate|evaluates)\b/i.test(
      normalizedQuestion
    ) ||
    /\baccording to (this |the )?paper\b/i.test(normalizedQuestion);

  return asksConceptDefinition && (!asksPaperFact || asksExplicitMeaning);
}

export function selectOpeningChunks(
  chunks: PaperChunkForRetrieval[],
  maxChunks = MAX_CONTEXT_CHUNKS
) {
  return capChunks(chunks.slice(0, maxChunks), maxChunks);
}

export function selectCombinedChunks(
  chunkGroups: PaperChunkForRetrieval[][],
  maxChunks = MAX_CONTEXT_CHUNKS
) {
  const uniqueChunks = new Map<string, PaperChunkForRetrieval>();

  chunkGroups.flat().forEach((chunk) => {
    if (!uniqueChunks.has(chunk.id)) {
      uniqueChunks.set(chunk.id, chunk);
    }
  });

  return capChunks(Array.from(uniqueChunks.values()), maxChunks);
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

function capChunks(chunks: PaperChunkForRetrieval[], maxChunks = MAX_CONTEXT_CHUNKS) {
  const selected: PaperChunkForRetrieval[] = [];
  let charCount = 0;

  for (const chunk of chunks) {
    if (selected.length >= maxChunks) break;
    if (charCount > 0 && charCount + chunk.text.length > MAX_CONTEXT_CHARS) break;

    selected.push(chunk);
    charCount += chunk.text.length;
  }

  return selected.sort((a, b) => a.page_number - b.page_number || a.chunk_index - b.chunk_index);
}

export function selectRelevantChunks(
  question: string,
  chunks: PaperChunkForRetrieval[],
  maxChunks = MAX_CONTEXT_CHUNKS
) {
  const terms = tokenize(question);

  if (isBroadPaperQuestion(question)) {
    return selectOpeningChunks(chunks, maxChunks);
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

  return capChunks(rankedChunks, maxChunks);
}
