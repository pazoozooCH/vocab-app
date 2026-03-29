# Anki Import

Import existing Anki cards into the Vocab app for duplicate detection and vocabulary management.

## Goal

- Import words from an Anki `.apkg` export so they appear in the word list
- Detect duplicates when adding new words via the AI translation flow
- Support re-importing: new words are added, changed words are updated, identical words are skipped
- Sync back changes made to our own exported words in Anki

## Scope

### Included

- Decks under `English` and `Français` (and their sub-decks)
- Note types: Basic, Basic (and reversed card), Einfach (beide Richtungen), French Word, Vocab (reversed)
- Our own "Vocab (reversed)" notes: compare with existing data, update if changed

### Excluded

- Decks not under `English` or `Français` (e.g. `C1-C2 German-English`)
- Media files (audio, images)
- Anki scheduling data (review history, intervals)

## Data Analysis

Analyzed from user's Anki export (March 2026, ~10,000 cards).

### Note Types

| ID | Name | Notes | Language | Import? |
|----|------|-------|----------|---------|
| 1727109230785 | Basic (and reversed card) | 4,091 | EN + FR | Yes |
| 1459520588346 | Einfach (beide Richtungen) | 673 | EN | Yes |
| 1683059128297 | French Word | 5,000 | FR | Yes |
| 1607392319100 | Vocab (reversed) | 85 | — | Yes (sync back) |
| 1727109230784 | Basic | 8 | EN | Yes |

### Field Structures

#### Basic / Einfach / Basic (and reversed card)

Two fields separated by `\x1f`:
- **Field 0** (Front/Vorderseite): source word + sentences
- **Field 1** (Back/Rückseite): German translation + sentences

HTML format:
```
word<br><ol><li>Sentence one.</li><li>Sentence two.</li></ol>
```

Parsing:
1. Split on first `<br>` → word (before) and sentences (after)
2. Strip HTML tags from word, extract text
3. Extract `<li>` contents for sentences, strip inner HTML tags
4. Some notes have no sentences (just `word\x1fTranslation`)

#### French Word (Französisch 5000)

15 fields separated by `\x1f`:

| Index | Name | Use |
|-------|------|-----|
| 0 | Rang | Frequency ranking (informational) |
| 1 | Wort | Word without article |
| 2 | Wort mit Artikel | **Word with article** → use as source word |
| 3 | Femininum / Plural | Alternative forms |
| 4 | Wortart | Part of speech |
| 5 | IPA | Pronunciation |
| 6 | Definition | **German translations** |
| 7 | Beispielsätze | **Example sentences** (FR + DE pairs, `*word*` for bold) |
| 8 | Audio | Sound file reference (ignore) |
| 9 | Notiz | Grammar notes (ignore) |
| 10 | Konjugation | Conjugation (ignore) |
| 11 | Register | Register/style (ignore) |
| 12 | Dispersion | Statistical (ignore) |
| 13 | Häufigkeit | Frequency (ignore) |
| 14 | English | English translation (informational) |

Sentence format in field 7:
```
Vive *la* politique, vive *l'*amour.
Es lebe *die* Politik, es lebe *die* Liebe.

*Le* chien de mon voisin aboie toute la nuit.
*Der* Hund meines Nachbarn bellt die ganze Nacht.
```

Parsing:
1. Split by double newline (`\n\n`) → sentence pairs
2. Each pair: first line = French, second line = German
3. `*word*` marks bold → convert to `**word**` (our markdown format)
4. Limit to 3 sentence pairs (some words have 50+)

#### Vocab (reversed) — Sync Back

Our own exports. Field 2 contains VocabID (UUID).
- Match by VocabID to find the corresponding word in our DB
- Compare fields: if Front/Back changed in Anki, update our word
- If VocabID not found in our DB, treat as new import

### Deck Structure

Decks use `\x1f` as hierarchy separator (displayed as `::` in Anki UI).

Relevant decks:
```
English
English\x1f1. Games
English\x1f1. Games\x1fFire Emblem
English\x1f2. Various
English\x1f3. Comics
English\x1fC1-C2 Curated
Français
Français\x1f1 Personelle
Français\x1f1 Personelle\x1f1a. CoLanguage
Français\x1f1 Personelle\x1f1b. Comics
Français\x1fFranzösisch 5000
Français\x1fFranzösisch 5000\x1f1. FR → DE
Français\x1fFranzösisch 5000\x1f2. DE → FR
```

**Important**: French Word notes have cards in **two** sub-decks (`FR → DE` and `DE → FR`). Each note produces 2 cards in different decks. Import the **note** once, not each card. Use the parent deck (`Français::Französisch 5000`) for assignment.

### Language Detection

From the **top-level** deck name of the card:
- `English*` → EN
- `Français*` → FR

Convert Anki `\x1f` separator to `::` for our deck names.

## Database Changes

### New WordStatus value

Add `imported` to the allowed values:
- `pending` — added via the app, not yet exported
- `exported` — added via the app, exported to Anki
- `imported` — imported from Anki

Migration: update CHECK constraint on `words.status` to include `'imported'`.

### New column: `anki_guid`

Add `anki_guid text` column to `words` table:
- Nullable (only set for imported words and our exported words synced back)
- Unique per user: `UNIQUE(user_id, anki_guid)` prevents duplicate imports
- Stores the Anki note `guid` (e.g. `B[LorXuOhh`)

For our own "Vocab (reversed)" notes: the VocabID field contains our word UUID, so we match by that instead of guid. But we still store the guid for completeness.

### Deck auto-creation

Imported words need decks. Auto-create decks from the Anki hierarchy:
- `English\x1f1. Games` → create deck `English::1. Games` with language EN
- Reuse existing decks if they match by name and language

## Import Flow (UX)

### Step 1: Upload

User uploads an `.apkg` file on the Import page.

### Step 2: Analysis & Preview

Parse the file client-side and show a summary:

```
Import Analysis
───────────────
Decks found: 12 (importing 8 under English/Français)
Skipped decks: 4 (C1-C2 German-English, ...)

Notes found: 9,857
  ├── New words: 8,200 (will be added)
  ├── Unchanged: 1,500 (will be skipped)
  ├── Updated: 72 (will be updated)
  └── Vocab sync: 85 (our exports, 3 changed)

By language:
  🇬🇧 English: 4,772
  🇫🇷 French: 5,085

By note type:
  Basic (and reversed card): 4,091
  French Word: 5,000
  Einfach (beide Richtungen): 673
  Vocab (reversed): 85
  Basic: 8
```

Optionally expand to see sample words per category.

### Step 3: Confirm or Cancel

User reviews the summary and clicks "Import" or "Cancel".

### Step 4: Import Execution

1. Create decks that don't exist yet
2. Batch insert new words (status: `imported`)
3. Batch update changed words
4. Skip unchanged words
5. For Vocab (reversed) notes: match by VocabID, update if changed
6. Show final summary: X added, Y updated, Z skipped

## Implementation Plan

### Phase 1: Parser (`src/infrastructure/anki/parseApkg.ts`)

Client-side `.apkg` parser:
1. Read ZIP → extract `collection.anki21b` (zstd-compressed) using `fzstd` library
2. Open SQLite via sql.js
3. Query notes, cards, decks, notetypes, fields
4. For each note: parse fields, determine language, extract word data
5. Return structured import data

**Dependency**: `fzstd` (small, pure JS zstd decompressor, ~15KB) — needed because `collection.anki2` is a stub in modern Anki exports.

### Phase 2: Analysis Engine

Compare parsed data with existing DB:
1. Fetch all existing `anki_guid` values for the user
2. Fetch all existing words with VocabID (for sync-back)
3. Categorize each note: new / unchanged / updated / vocab-sync
4. Build the summary statistics

### Phase 3: Import UI

- Accessible from the word list page via an "Import" button, or from top bar
- File upload → analysis → preview → confirm/cancel → progress → done
- Show progress during import (X of Y)

### Phase 4: Import Execution

- Batch operations for performance (not one-by-one)
- Create missing decks first
- Insert new words in batches
- Update changed words in batches
- Report results

## Capacity & Performance

### Supabase Free Tier

- 500 MB database storage — ~10k words ≈ 5-10 MB (well within limits)
- No row count limits
- API rate limits: generous for batch operations

### App Performance

- Server-side pagination already implemented (30 words per page)
- Search uses server-side ILIKE + client-side sentence search
- Infinite scroll handles large lists
- No performance issues expected with 10k+ words

### Import Performance

- Client-side parsing: sql.js + zstd should handle 30 MB SQLite in seconds
- DB inserts: batch insert (e.g. 100 rows per request) for ~50 requests total
- Expected total import time: 10-30 seconds

## Open Questions

1. **Import page location**: button on word list page, or top bar link like Stats?
2. **"Einfach" notes are German-fronted** (DE→EN): flip so English is the "source word"? Or import as-is with German as source?
3. **Sentence limit**: 3 sentences per word for French Word notes — confirm?
4. **collection.anki2 vs anki21b**: confirmed that anki2 is a stub. Need `fzstd` for zstd decompression.
