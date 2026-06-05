# PaperTalk

Upload research papers and talk to an AI assistant. This is the **UI-only** phase — mock data, no backend.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- shadcn/ui (monochrome)
- next-themes (system / light / dark)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow

1. `/` — Splash with typing animation
2. `/auth` — Sign in UI + **Continue to Demo**
3. `/app` — Three-panel workspace (sidebar, PDF viewer, chat/voice)

## Later phases

- Supabase Auth, Postgres, Storage
- PDF upload and processing
- RAG chat with free models
- Voice STT/TTS backend
