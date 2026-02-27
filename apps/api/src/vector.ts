export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  const denom = Math.sqrt(aMag) * Math.sqrt(bMag);
  if (denom === 0) return 0;
  return dot / denom;
}

export function topK<T>(items: T[], k: number, score: (item: T) => number): Array<{ item: T; score: number }> {
  const scored = items.map((item) => ({ item, score: score(item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
