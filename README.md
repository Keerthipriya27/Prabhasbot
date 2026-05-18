# PrabhasBot - Retrieval-Augmented Chatbot

PrabhasBot is a document-grounded chatbot built with React and Supabase.
Upload PDF/TXT/MD files, index them into embeddings, and chat with answers grounded in retrieved document chunks.

## Features

- Streaming chat responses (SSE)
- Retrieval-augmented generation (RAG)
- Document upload and indexing
- Per-user document isolation with Supabase auth
- Source-aware answers using inline file citations

## Architecture

1. User uploads a document from the sidebar.
2. `ingest-document` downloads the file, extracts text, chunks it, creates embeddings, and stores chunks in `document_chunks`.
3. User asks a question in chat.
4. `chat` embeds the question, retrieves top matching chunks via `match_document_chunks`, and streams a grounded answer.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: Supabase (Auth, Storage, Postgres, Edge Functions)
- AI Provider: OpenAI (`gpt-4o-mini`, `text-embedding-3-small`)

## Setup

1. Install dependencies

```bash
npm install
```

2. Start frontend

```bash
npm run dev
```

3. Set required Supabase function secret

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

4. Deploy functions (if needed)

```bash
supabase functions deploy chat
supabase functions deploy ingest-document
```

## Important Files

- `src/pages/Index.tsx` - main chatbot page
- `src/components/DocumentSidebar.tsx` - upload/manage knowledge base files
- `src/lib/streamChat.ts` - frontend SSE chat streaming client
- `supabase/functions/chat/index.ts` - retrieval + grounded streaming answers
- `supabase/functions/ingest-document/index.ts` - text extraction, chunking, embeddings

## Notes

- `chat` and `ingest-document` are the core RAG path.
- If no indexed documents exist, chat can still answer generally, but retrieval citations appear only when matches are found.
