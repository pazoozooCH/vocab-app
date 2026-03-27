# Vocab App — Agent Guidelines

## Project Overview

Mobile-friendly web app for collecting EN/FR → DE vocabulary with AI-powered translation and Anki export. See `README.md` for full requirements.

## Architecture Principles

### Clean Architecture

Follow Clean Architecture with clear dependency rules — inner layers never depend on outer layers.

```
src/
├── domain/           # Entities, value objects, domain errors (no external dependencies)
├── application/      # Use cases / application services (depends only on domain)
├── infrastructure/   # Supabase client, Gemini API client, Anki export (implements interfaces from application)
└── ui/               # React components, pages, hooks (depends on application layer via dependency injection)
```

- **Domain layer**: Pure TypeScript. Contains `Word`, `Deck`, `Translation` entities and value objects. No imports from Supabase, React, or any framework.
- **Application layer**: Use cases like `AddWord`, `ExportDeck`. Depends on repository interfaces (ports), not implementations.
- **Infrastructure layer**: Implements repository interfaces using Supabase SDK, Gemini API, etc. This is the only layer that knows about external services.
- **UI layer**: React components. Calls use cases from the application layer, never touches infrastructure directly.

### Domain-Driven Design

- Identify and name concepts from the vocabulary learning domain (Word, Translation, Deck, Sentence, Export)
- Use value objects for things like `Language` (EN/FR), `WordStatus` (pending/exported)
- Keep business logic in the domain layer — e.g., validation rules, formatting logic
- Repository interfaces defined in the application layer, implemented in infrastructure

## Development Practices

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig)
- No `any` types — use `unknown` and narrow, or define proper types
- Prefer interfaces for contracts, types for unions/intersections
- Use branded types or value objects for domain identifiers (e.g., `WordId`, `DeckId`)

### Test-Driven Development (TDD)

- **Write tests first**, then implement to make them pass
- Test file naming: `*.test.ts` colocated next to the source file
- Test layers independently:
  - **Domain**: Unit tests for entities and value objects (pure logic, no mocks)
  - **Application**: Unit tests for use cases with mocked repository interfaces
  - **Infrastructure**: Integration tests for Supabase queries and API calls
  - **UI**: Component tests with React Testing Library
- **E2E tests**: Playwright for critical user flows (add word, export deck, login)
  - E2E tests live in `e2e/` directory
  - Run against a local or staging environment
  - Use element IDs (`#my-element`) to select DOM elements whenever possible — avoids brittle CSS class selectors
- Run tests before committing: `npm test`
- Run e2e tests: `npm run test:e2e`

### Documentation

- Keep `README.md` up to date whenever development, setup, or deployment processes change
- If a change affects how someone would set up, run, test, or deploy the app, update the README in the same commit

### Git Practices

- Commit after every meaningful unit of work (new entity, completed use case, passing test suite, etc.)
- Write concise commit messages focused on the "why"
- Do not bundle unrelated changes in a single commit
- Keep commits small enough to be reviewable

### Database Migrations

- **The production database contains real user data. Migrations MUST NOT lose data.**
- All migrations must be backwards-compatible: add columns as nullable or with defaults, never drop columns with data, use multi-step migrations for renames (add new → copy → drop old).
- Test migrations locally with `npm run db:reset` before pushing to production with `npm run db:push`.
- Never use `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` on tables that contain production data without explicit user approval.

### Deployment

- All deployment is automated — no manual steps
- Use Vercel CLI or GitHub integration for frontend/serverless deployment
- Use Supabase CLI for database migrations (`supabase db push`)
- CI/CD pipeline runs: lint → type-check → unit tests → e2e tests → deploy
- Deployment scripts live in `scripts/` or are defined in `package.json`
- Environment variables are managed via Vercel project settings (never committed)

## Tech Stack Quick Reference

| What            | Tool                              |
|-----------------|-----------------------------------|
| Language        | TypeScript (strict mode)          |
| Frontend        | React + Vite                      |
| Database + Auth | Supabase (PostgreSQL + Google OAuth) |
| AI              | Gemini API (Vercel serverless fn) |
| Unit Tests      | Vitest                            |
| E2E Tests       | Playwright                        |
| Linting         | ESLint + Prettier                 |
| Deployment      | Vercel + Supabase CLI             |

## File Naming Conventions

- Source files: `camelCase.ts` for utilities, `PascalCase.tsx` for React components
- Test files: `<name>.test.ts` / `<Name>.test.tsx` next to source
- Domain entities: `src/domain/entities/Word.ts`
- Use cases: `src/application/usecases/addWord.ts`
- Repositories: `src/application/ports/WordRepository.ts` (interface), `src/infrastructure/supabase/SupabaseWordRepository.ts` (implementation)

## Key Commands

```bash
npm run check        # Quiet CI: build + lint + test + e2e (errors only, use this for validation)
npm run dev          # Start local dev server
npm test             # Run unit/integration tests (Vitest)
npm run test:e2e     # Run Playwright e2e tests
npm run lint         # ESLint + type-check
npm run build        # Production build
npm run format       # Prettier format all files

npm run db:start     # Start local Supabase (Docker)
npm run db:stop      # Stop local Supabase
npm run db:restart   # Restart local Supabase (picks up config changes)
npm run db:reset     # Reset local DB and re-run all migrations
npm run db:push      # Push migrations to cloud Supabase (production)
```
