const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_BASE_URL = "https://api.cartesia.ai";
const CARTESIA_VERSION = "2025-04-16";

const DEFAULT_TTS_MODEL = process.env.CARTESIA_TTS_MODEL || "sonic";
const DEFAULT_TTS_VOICE_ID = process.env.CARTESIA_TTS_VOICE_ID || "default";
const DEFAULT_TTS_FORMAT = process.env.CARTESIA_TTS_FORMAT || "mp3";

const DEFAULT_STT_MODEL = process.env.CARTESIA_STT_MODEL || "stt";
const DEFAULT_STT_LANGUAGE = process.env.CARTESIA_STT_LANGUAGE || "en";

if (!CARTESIA_API_KEY) {
  console.warn("Missing CARTESIA_API_KEY env var.");
}

export async function cartesiaSttBatch(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  const file = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  form.append("file", file, "audio.webm");
  form.append("model", DEFAULT_STT_MODEL);
  form.append("language", DEFAULT_STT_LANGUAGE);

  const res = await fetch(`${CARTESIA_BASE_URL}/stt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CARTESIA_API_KEY}`,
      "Cartesia-Version": CARTESIA_VERSION,
    },
    body: form as any,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cartesia STT error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const transcript = json.text || json.transcript || "";
  return String(transcript);
}

export async function cartesiaTtsBytes(text: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(`${CARTESIA_BASE_URL}/tts/bytes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CARTESIA_API_KEY}`,
      "Cartesia-Version": CARTESIA_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model: DEFAULT_TTS_MODEL,
      voice: DEFAULT_TTS_VOICE_ID,
      output_format: DEFAULT_TTS_FORMAT,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cartesia TTS error: ${res.status} ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const mimeType = DEFAULT_TTS_FORMAT === "mp3" ? "audio/mpeg" : "audio/wav";
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}
