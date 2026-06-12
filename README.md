# PaperTalk

PaperTalk is a research-paper workspace for uploading PDFs, reading them in a custom viewer, and chatting with extracted paper text.

The current V1 focus is real auth, private PDF storage, PDF text extraction, and beta paper chat with page citations. Voice remains intentionally disabled until chat settles.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- shadcn/ui-style components (monochrome)
- next-themes (system / light / dark)
- Supabase Auth, Postgres, and private Storage
- PDF.js via `pdfjs-dist`
- Gemini API / Gemini Flash for beta paper chat

## Implemented

- Email/password auth with Supabase
  - Sign up, log in, sign out
  - Email confirmation
  - Forgot password and update password
  - Protected `/app` route
- User profiles
  - Default username from the email prefix
  - Editable unique username in the sidebar profile hover panel
- Private PDF library
  - Authenticated per-user uploads
  - PDF-only validation
  - 25 MB file limit
  - Owner-only listing and deletion
- Custom PDF viewer
  - Private PDF download through Supabase auth
  - Canvas rendering with PDF.js
  - Continuous scroll
  - Fit-width zoom controls
  - Current page tracking
  - Text selection layer
  - Normalized copy/paste for selected PDF text
- PDF text extraction
  - Automatic extraction after upload
  - Page-level text storage
  - Chunk storage for retrieval and citations
  - Clear failed state for scanned/image-only PDFs
- Beta PaperChat
  - Enabled after extraction completes
  - Keyword-ranked chunk retrieval
  - Gemini Flash responses
  - Backend-owned page/chunk citations
  - Persisted per-paper chat history
  - Privacy warning for non-confidential documents
- Workspace shell
  - Sidebar paper library
  - Empty state upload affordance
  - Close paper without deleting it
  - Voice panel disabled with honest "coming later" copy

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, usually [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local` and fill in the Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GEMINI_API_KEY=
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is preferred. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still supported as a fallback.

PaperChat uses the Gemini API free tier. Treat it as beta: do not upload confidential documents because prompts may be logged or used by the provider.

## Supabase

The app expects the migrations in `supabase/migrations` to be applied:

- `profiles` table with unique usernames
- private `papers` Storage bucket
- `papers` table
- `paper_pages`, `paper_chunks`, and `paper_messages`
- RLS policies for owner-only profile, paper, extraction, and chat access

After linking the Supabase project, apply migrations with:

```bash
supabase db push
```

## Flow

1. `/` — Splash with typing animation
2. `/auth` — Supabase auth page
3. `/auth/callback` — Email confirmation and recovery callback
4. `/app` — Protected workspace with sidebar, PDF viewer, text extraction, and beta paper chat

## Coming up

- Embeddings/retrieval for larger documents
- Clickable citations that scroll the PDF
- Voice input/output once chat is stable
- Google sign-in after Supabase and Google provider setup
- More PDF viewer polish only where it supports reading or citations
