import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REALTIME_MODEL: z.string().default("gpt-4o-realtime-preview"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_OCR_MODEL: z.string().default("gpt-4o-mini"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  VERCEL_BLOB_READ_WRITE_TOKEN: z.string().min(1),
  APP_AUTH_PASSWORD: z.string().min(1),
  APP_SESSION_SECRET: z.string().min(16)
});

let cached: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cached) return cached;
  cached = envSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    OPENAI_OCR_MODEL: process.env.OPENAI_OCR_MODEL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VERCEL_BLOB_READ_WRITE_TOKEN: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    APP_AUTH_PASSWORD: process.env.APP_AUTH_PASSWORD,
    APP_SESSION_SECRET: process.env.APP_SESSION_SECRET
  });
  return cached;
}
