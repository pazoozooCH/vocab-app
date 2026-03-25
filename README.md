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
- App translates the word to German using AI (Claude API)
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
| Backend     | None — Supabase client SDK for DB/auth, single Vercel serverless function for Claude API |
| Database    | Supabase (PostgreSQL, free tier)    |
| Auth        | Supabase Auth with Google OAuth     |
| Hosting     | Vercel (free tier)                  |
| AI          | Claude API via Vercel serverless function (keeps API key server-side) |
| Anki Export | `anki-apkg-export` or custom SQLite-based `.apkg` generator |
| Dev Tooling | MCP servers (see below)             |

### MCP Servers

The following MCP servers are used during development with Claude Code:

| MCP Server       | Purpose                                                       |
|------------------|---------------------------------------------------------------|
| **Supabase MCP** | Manage database schema, tables, RLS policies, and auth config directly from the CLI |
| **Playwright MCP** | Run and debug Playwright e2e tests interactively             |
| **Context7**     | Pull up-to-date documentation for React, TypeScript, Supabase, etc. into context |

### Architecture
- **No dedicated backend** — the React app talks directly to Supabase for auth and CRUD operations
- **One serverless function** (`/api/translate`) — receives a word, calls Claude API, returns translation + sentences. This is the only server-side code, needed to keep the Anthropic API key secret.
- **Supabase RLS** ensures users can only access their own data without backend middleware
- **Supabase** free tier: 500 MB database, 50,000 monthly active users
- **Vercel** free tier: generous for personal use, zero config deployment
- Both are free for a single-user personal app

### Authentication & Access Control
- Google OAuth login via Supabase Auth
- **Email whitelist**: only pre-approved email addresses can use the app
  - Whitelist stored as an `allowed_users` table in Supabase (or environment variable)
  - Supabase RLS policies check the user's email against the whitelist on every query
  - The `/api/translate` serverless function also validates the user's JWT and checks the whitelist before calling Claude API
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
| Field | Type   | Description     |
|-------|--------|-----------------|
| id    | UUID   | Primary key     |
| name  | string | Deck name       |

## API

### Serverless Function (Vercel)
```
POST /api/translate   — Receives { word, language }, calls Claude API, returns translations + sentences
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

## MVP Scope

Phase 1 (MVP):
- Google OAuth login
- Add words with AI translation + sentence generation
- Store in Supabase PostgreSQL
- Browse/edit saved words
- Export to `.apkg` file
- Deploy to Vercel

Phase 2:
- AnkiConnect sync (desktop)
- Offline support (PWA)
- Batch word entry
- Word history / statistics

## Getting Started

```bash
# Prerequisites: Node.js 20+, npm

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your keys to .env:
#   ANTHROPIC_API_KEY     — for Claude API
#   SUPABASE_URL          — from Supabase project settings
#   SUPABASE_ANON_KEY     — from Supabase project settings
#   ANTHROPIC_API_KEY is only used server-side (Vercel serverless function)

# Start development
npm run dev
```

## Deployment

1. Create a Supabase project at https://supabase.com (free tier)
2. Enable Google OAuth in Supabase → Authentication → Providers
3. Run the database migrations (SQL in `supabase/migrations/`)
4. Deploy to Vercel: connect the GitHub repo, set environment variables
5. Add the Vercel URL to Supabase → Authentication → URL Configuration
