import OpenAI from "openai";
import { getEnv } from "./env";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    const env = getEnv();
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}
