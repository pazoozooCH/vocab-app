# Vocab App

A mobile-friendly web app for collecting vocabulary and syncing it to Anki.

## Problem

Learning vocabulary (English, French → German) currently involves:
1. Encountering a new word
2. Looking it up on Leo.org
3. Writing it down in a notebook
4. Later, manually having a chatbot generate sample sentences
5. Manually creating Anki cards

This app automates steps 2–5 into a single action.

## Requirements

### Core Workflow
- User enters a word (English or French)
- App detects the source language (EN or FR)
- App translates the word to German using AI (Gemini API)
- App generates 2–3 sample sentences in both the source language and German
- Card is stored in the app's database, ready for Anki export

### Anki Integration
- Export cards as `.apkg` files (Anki deck packages) for import
- Card type: **Basic (and reversed card)**
  - Front: foreign word + sample sentences (EN or FR), word **bold** in sentences
  - Back: German translation(s) + sample sentences in German, word **bold** in sentences
  - Multiple German translations shown if the word has several common meanings
- Support multiple Anki decks — user selects the target deck on export
- Optional: AnkiConnect integration for direct sync when running on desktop

### User Interface
- Mobile-friendly web app (responsive, works well on phone browsers)
- Simple input: type a word, hit enter
- Review screen: see pending cards before export
- Deck management: create/select target decks
- Edit capability: modify translations or sentences before export

### Card Formatting
- Sample sentences displayed as bullet points
- The vocabulary word is **highlighted/bold** within each sample sentence
- German translations can contain multiple meanings (e.g. "run" → "laufen, rennen, betreiben")

### Non-Functional Requirements
- Lightweight, fast — optimized for quick word entry on mobile
- Cloud-hosted database so words added on phone are available on desktop for Anki export
- Data persists between sessions

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React + TypeScript (Vite)           |
| Backend     | None — Supabase client SDK for DB/auth, single Vercel serverless function for Gemini API |
| Database    | Supabase (PostgreSQL, free tier)    |
| Auth        | Supabase Auth with Google OAuth     |
| Hosting     | Vercel (free tier)                  |
| AI          | Gemini API via Vercel serverless function (free tier, keeps API key server-side) |
| Anki Export | `anki-apkg-export` or custom SQLite-based `.apkg` generator |
| Dev Tooling | MCP servers (see below)             |

> **Why Gemini over Claude API?** Both produce excellent translations. Gemini was chosen because it offers a free tier (250 requests/day with Gemini 2.5 Flash), which is more than enough for a personal vocab app. The Anthropic API has no free tier and charges per token.

### MCP Servers

The following MCP servers are used during development with Claude Code:

| MCP Server       | Purpose                                                       |
|------------------|---------------------------------------------------------------|
| **Supabase MCP** | Manage database schema, tables, RLS policies, and auth config directly from the CLI |
| **Playwright MCP** | Run and debug Playwright e2e tests interactively             |
| **Context7**     | Pull up-to-date documentation for React, TypeScript, Supabase, etc. into context |

### Architecture
- **No dedicated backend** — the React app talks directly to Supabase for auth and CRUD operations
- **One serverless function** (`/api/translate`) — receives a word, calls Gemini API, returns translation + sentences. This is the only server-side code, needed to keep the API key secret.
- **Supabase RLS** ensures users can only access their own data without backend middleware
- **Supabase** free tier: 500 MB database, 50,000 monthly active users
- **Vercel** free tier: generous for personal use, zero config deployment
- Both are free for a single-user personal app

### Project Structure (Clean Architecture + DDD)

The codebase follows Clean Architecture with Domain-Driven Design. Inner layers have no dependencies on outer layers — all dependencies point inward.

```
src/
├── domain/              # Inner layer — pure business logic, no external dependencies
│   ├── entities/        # Word, Deck — core objects with identity and behavior
│   └── values/          # Language (EN|FR), WordStatus (pending|exported) — immutable types
│
├── application/         # Use cases — orchestrate domain objects to fulfill user actions
│   ├── usecases/        # addWord (translate + save), exportDeck (mark exported + return)
│   └── ports/           # Interfaces that the outer layers must implement
│                        #   WordRepository, DeckRepository, TranslationService
│
├── infrastructure/      # Outer layer — implements ports with real services
│   └── supabase/        # Supabase implementations of repository interfaces
│
└── ui/                  # React components, pages, hooks — calls use cases, never infra directly
```

**Key ideas:**
- **Entities** (`Word`, `Deck`) are immutable and created via factory methods (`Word.create()`). Mutations return new instances (e.g. `word.markExported()`).
- **Value objects** (`Language`, `WordStatus`) are simple constrained types with no identity.
- **Ports** define what the application needs (e.g. "save a word", "translate a word") without knowing how.
- **Use cases** are plain functions that take input + dependencies (ports) and return results. Easy to test with mocks.
- **Infrastructure** is the only layer that knows about Supabase, the Gemini API, etc.

### Authentication & Access Control
- Google OAuth login via Supabase Auth
- **Email whitelist**: only pre-approved email addresses can use the app
  - Whitelist stored as an `allowed_users` table in Supabase (or environment variable)
  - Supabase RLS policies check the user's email against the whitelist on every query
  - The `/api/translate` serverless function also validates the user's JWT and checks the whitelist before calling Gemini API
- Non-whitelisted users see a "not authorized" message after login — no data access, no API costs
- Session persists via Supabase client library (auto-refresh tokens)

## Data Model

### Word
| Field            | Type     | Description                        |
|------------------|----------|------------------------------------|
| id               | UUID     | Primary key                        |
| user_id          | UUID     | Foreign key → Supabase auth.users  |
| word             | string   | The foreign word                   |
| language         | enum     | `EN` or `FR`                       |
| translations     | string[] | German translations (multiple meanings) |
| sentences_source | string[] | Sample sentences in source language |
| sentences_german | string[] | Sample sentences in German         |
| deck             | string   | Target Anki deck name              |
| status           | enum     | `pending` / `exported`             |
| created_at       | datetime | When the word was added            |
| exported_at      | datetime | When last exported to Anki         |

### Deck
| Field    | Type   | Description                                |
|----------|--------|--------------------------------------------|
| id       | UUID   | Primary key                                |
| user_id  | UUID   | Foreign key → Supabase auth.users          |
| name     | string | Deck name (Anki hierarchical, e.g. `English::Verbs`) |
| language | enum   | `EN` or `FR` — decks are per language      |

## API

### Serverless Function (Vercel)
```
POST /api/translate   — Receives { word, language }, calls Gemini API, returns translations + sentences
```

### Direct Supabase Access (from frontend via SDK)
- Words: CRUD via `supabase.from('words').select/insert/update/delete()`
- Decks: CRUD via `supabase.from('decks').select/insert/update/delete()`
- Auth: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Export: `.apkg` generation runs client-side in the browser

## Screens

1. **Add Word** (home screen)
   - Text input + deck selector
   - Shows translation + sentences immediately after submission

2. **Word List**
   - Browse all saved words, filter by deck and status
   - Tap to edit or delete

3. **Export**
   - Select a deck, preview pending words, download `.apkg`

## Features

- **Google OAuth** login via Supabase Auth
- **AI-powered translation** — enter a word (EN/FR), get German translations + sample sentences via Gemini API (free tier, with automatic model fallback)
- **Domain classifiers** — translations tagged with context like _[Law]_, _[Med]_, _[Coll]_ where appropriate
- **Context refinement** — refine a translation with a hint (e.g. "for sitting" for "bank") to narrow the meaning
- **Batch add** — add multiple words at once, comma-separated
- **Deck management** — create and delete decks, per language, with Anki hierarchical naming (`English::Verbs`)
- **Duplicate detection** — warns when adding a word that already exists, shows potential duplicates
- **Word list** — compact expandable rows, filter by language/deck/status
- **Anki export** — generate `.apkg` files with "Basic (and reversed card)" note type, hierarchical decks, bold vocabulary words in HTML. Export history with confirm/fail/delete workflow.
- **Dark mode** — automatic via `prefers-color-scheme`
- **PWA** — installable on mobile with custom icon
- **Responsive** — mobile-first, works on phone and desktop
- **Persistent UI state** — language, deck, and mode selections saved across sessions
- **Email whitelist** — only pre-approved emails can access the app, enforced via RLS and API checks

### Anki Compatibility

- Tested with Anki 25.09.2 (3890e12c), Python 3.14.3, Qt 6.10.2
- Export format: `.apkg` (Anki Deck Package) with `collection.anki2` SQLite database
- Note type: "Basic (and reversed card)" with `originalStockKind: 1` — merges with the user's existing stock note type on import (no duplicate `+` suffix)
- Deck hierarchy: `English::Verbs` creates nested decks automatically using `\x1f` separator
- Cards: each word creates 2 cards (source→German and German→source)
- Formatting: bold vocabulary words (`<b>`), italic classifiers (`<i>`) in HTML
- Sample export file for reference: `samples/Export.apkg`

## Pending Features

- **Word editing** — modify translations, sentences, or deck assignment after adding
- **AnkiConnect sync** — direct sync to Anki desktop via AnkiConnect
- **Offline support** — service worker caching for offline use
- **Word history / statistics** — track learning progress

## Getting Started

```bash
# Prerequisites: Node.js 20+, npm, Docker

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in your keys (see .env.example for descriptions)

# Start local Supabase (requires Docker)
# Reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from .env for local OAuth
npx supabase start
# Copy the printed Publishable key into .env as VITE_SUPABASE_ANON_KEY

# Set up MCP servers for Claude Code
source .env
claude mcp add supabase \
  -e SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN \
  -e SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_REF \
  -- npx -y @supabase/mcp-server-supabase@latest

# Start development
npm run dev
```

### Environments

| Environment | Database | URL | Purpose |
|-------------|----------|-----|---------|
| Local | Local Supabase (Docker) | `http://127.0.0.1:54321` | Development and testing |
| Production | Supabase Cloud | `https://<project-ref>.supabase.co` | Live app |

- **Local**: started with `npx supabase start`, stopped with `npx supabase stop`. Data can be reset with `npx supabase db reset`.
- **Production**: cloud project, migrations applied with `npx supabase db push`.
- Migrations live in `supabase/migrations/` and are developed locally first, then pushed to production.

### Testing Strategy

Both local development and integration tests share the same local Supabase instance. Data isolation is achieved by user ID — the same way RLS works in production:

- **Dev/manual testing** uses your real authenticated user ID. Data persists between sessions.
- **Integration tests** (`npm test`) use a dedicated test user ID. Tests clean up their own rows in `beforeEach`/`afterAll`, so dev data is never touched.
- **E2e tests** (`npm run test:e2e`) use a separate e2e user with email/password auth. A global setup creates the user, signs in server-side, and injects the session into the browser's localStorage — bypassing Google OAuth entirely.

All three use different user IDs, so they never interfere with each other. `npx supabase start` must be running for both integration and e2e tests.

### Commands

```bash
npm run dev          # Start Vite dev server (http://127.0.0.1:5173)
npm test             # Run unit + integration tests (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run Playwright e2e tests (headless)
npm run lint         # ESLint + type-check
npm run build        # Production build
npm run format       # Prettier format all files

npm run db:start     # Start local Supabase (Docker)
npm run db:stop      # Stop local Supabase
npm run db:restart   # Restart local Supabase (picks up config changes)
npm run db:reset     # Reset local DB and re-run all migrations
npm run db:push      # Push migrations to cloud Supabase (production)
```

To see the browser during e2e tests: `npx playwright test --headed`
For interactive step-through mode: `npx playwright test --ui`

On failure, Playwright saves screenshots, video, and a full trace to `test-results/`. Inspect a trace with: `npx playwright show-trace test-results/<test-name>/trace.zip`

## Deployment

### One-time setup

1. **Supabase** (already done if you followed Getting Started)
   - Create a Supabase project at https://supabase.com (free tier)
   - Enable the **Data API** and **automatic RLS**
   - Enable **Google OAuth**, disable **Email auth**

2. **Google OAuth** (already done if you followed Getting Started)
   - Create OAuth Client ID at [Google Cloud Console](https://console.cloud.google.com/)
   - Add authorized redirect URIs:
     - Production: `https://<project-ref>.supabase.co/auth/v1/callback`
     - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - Add the **Client ID** and **Client Secret** to both cloud Supabase and local `.env`

3. **Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo (`pazoozooCH/vocab-app`)
   - Framework preset: **Vite**
   - Set environment variables in Vercel project settings:
     - `VITE_SUPABASE_URL` — your cloud Supabase URL (`https://<project-ref>.supabase.co`)
     - `VITE_SUPABASE_ANON_KEY` — your cloud Supabase anon/publishable key
     - `GEMINI_API_KEY` — your Gemini API key
   - Deploy

4. **Post-deploy**
   - Copy the Vercel production URL (e.g. `https://vocab-app-taupe.vercel.app`)
   - Add it to Supabase → Authentication → URL Configuration → Site URL
   - Add it to Supabase → Authentication → URL Configuration → Redirect URLs
   - Add `https://vocab-app-taupe.vercel.app` as an authorized JavaScript origin in Google Cloud Console
   - Add your email to the `allowed_users` table in Supabase (SQL Editor or dashboard):
     ```sql
     INSERT INTO allowed_users (email) VALUES ('your@email.com');
     ```

### Continuous deployment

Vercel auto-deploys on every push to `main` via GitHub integration. No manual steps needed.

Database migrations are **not** auto-deployed. After adding a new migration, push it manually:
```bash
npx supabase db push
```
