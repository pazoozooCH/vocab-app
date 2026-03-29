# Anki Import

Import existing Anki cards into the Vocab app for duplicate detection and vocabulary management.

## Goal

- Import words from an Anki `.apkg` export so they appear in the word list
- Detect duplicates when adding new words via the AI translation flow
- Support re-importing: new words are added, changed words are updated, identical words are skipped
- Sync back changes made to our own exported words in Anki
- Update deck assignments when words moved to different decks in Anki

## Scope

### Included

- All decks under `English` and `Français` (dynamically discovered, any depth)
- All note types found in those decks
- Our own "Vocab (reversed)" notes: sync back changes to existing words
- Deck reassignment: if a word moved to a different deck in Anki, update in Vocab

### Excluded

- Decks not under `English` or `Français` (e.g. `C1-C2 German-English`)
- Media files (audio, images)
- Anki scheduling data (review history, intervals)

## Data Analysis

Analyzed from user's Anki export (March 2026, ~10,000 cards).

### Note Types

| ID | Name | Notes | Import? |
|----|------|-------|---------|
| 1727109230785 | Basic (and reversed card) | 4,091 | Yes |
| 1459520588346 | Einfach (beide Richtungen) | 673 | Yes |
| 1683059128297 | French Word | 5,000 | Yes (special parser) |
| 1607392319100 | Vocab (reversed) | 85 | Yes (sync back) |
| 1727109230784 | Basic | 8 | Yes |

Note: only the "French Word" type (ID `1683059128297`) has the special 15-field structure. All other note types use the standard Front/Back (2-field) format, regardless of language.

### Field Structures

#### Standard Notes (Basic, Einfach, Basic and reversed)

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

**Language rule**: The non-German side is always the source word. For "Einfach (beide Richtungen)" which has German on the front (Vorderseite), flip: Back → source word, Front → German translation.

#### French Word (note type `1683059128297` only)

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
| 8–14 | Various | Audio, notes, conjugation, etc. (ignore) |

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
4. Limit to **5 sentence pairs** (some words have 50+)

#### Vocab (reversed) — Sync Back

Our own exports. Field 2 contains VocabID (UUID).
- Match by VocabID to find the corresponding word in our DB
- Compare fields: if Front/Back changed in Anki, update our word
- If VocabID not found in our DB, treat as new import

### Deck Structure

Decks use `\x1f` as hierarchy separator (displayed as `::` in Anki UI).

> **Note**: The deck list below is a sample from the analyzed export. The actual deck structure may change over time. The import dynamically discovers all sub-decks of `English` and `Français` — no hardcoded deck names.

Sample decks (March 2026):
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
Français\x1fFranzösisch 5000
Français\x1fFranzösisch 5000\x1f1. FR → DE
Français\x1fFranzösisch 5000\x1f2. DE → FR
```

**Important**: French Word notes have cards in **two** sub-decks (`FR → DE` and `DE → FR`). Each note produces 2 cards in different decks. Import the **note** once, not each card. Use the parent deck (`Français::Französisch 5000`) for assignment.

### Language Detection

From the **top-level** deck name of the card:
- Starts with `English` → EN
- Starts with `Français` → FR

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
- Nullable (only set for imported words and synced-back words)
- Unique per user: `UNIQUE(user_id, anki_guid)` prevents duplicate imports
- Stores the Anki note `guid` (e.g. `B[LorXuOhh`)

For our own "Vocab (reversed)" notes: match by VocabID first, fall back to guid. Store guid on all imported/synced words for future re-imports.

### Deck auto-creation and reassignment

- Auto-create decks from the Anki hierarchy when they don't exist in Vocab
- If an existing word has moved to a different deck in Anki:
  - Create the new deck if it doesn't exist
  - Update the word's `deck_id` to point to the new deck
  - Do **not** rename or modify the old deck (other words may still reference it)

## Import Flow (UX)

### Navigation

Replace the 4-tab bottom nav with 3 tabs + a "More" menu:
- **Add** — add words (primary action)
- **Words** — word list (primary action)
- **⋯ More** — menu with: Export, Import, Stats

### Step 1: Upload

User opens Import from the More menu, uploads an `.apkg` file.

### Step 2: Analysis & Preview

Parse the file client-side and show a summary:

```
Import Analysis
───────────────
Decks: 8 included (under English/Français), 4 skipped

Notes analyzed: 9,857
  ├── New words:    8,200  (will be added)
  ├── Unchanged:    1,500  (will be skipped)
  ├── Updated:         72  (will be updated)
  └── Vocab sync:      85  (our exports, 3 changed)

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

User can expand categories to preview sample words.

### Step 3: Confirm or Cancel

User reviews the summary and clicks **"Import"** or **"Cancel"**.

### Step 4: Import Execution

1. Create decks that don't exist yet
2. Batch insert new words (status: `imported`, with `anki_guid`)
3. Batch update changed words (content + deck reassignment)
4. Sync back Vocab (reversed) notes by VocabID
5. Show progress (X of Y)
6. Show final summary: X added, Y updated, Z skipped

## Implementation Plan

### Phase 1: Parser (`src/infrastructure/anki/parseApkg.ts`)

Client-side `.apkg` parser:
1. Read ZIP → extract `collection.anki21b` (zstd-compressed)
2. Decompress with `fzstd` library (pure JS, ~15KB, lazy-loaded on import page)
3. Open SQLite via sql.js
4. Query notes, cards, decks, notetypes, fields
5. Filter to English/Français decks
6. For each note: parse fields by note type, determine language, extract word data
7. Deduplicate notes (French Word has 2 cards per note — import once)
8. Return structured import data

### Phase 2: Analysis Engine

Compare parsed data with existing DB:
1. Fetch all existing `anki_guid` values for the user
2. Fetch all existing words with matching VocabID (for sync-back)
3. Categorize each parsed note: **new** / **unchanged** / **updated** / **vocab-sync**
4. Build summary statistics
5. Return categorized data for preview

### Phase 3: Import UI

- Accessible from More menu → Import
- File upload → analysis (with loading indicator) → preview → confirm/cancel → progress → done

### Phase 4: Import Execution

- Batch operations for performance (not one-by-one)
- Create missing decks first
- Batch insert new words
- Batch update changed words
- Report results

## Testing

### Synthetic test `.apkg`

Generate a test `.apkg` file programmatically using sql.js (same approach as our export generator):
- 3 Basic (and reversed) notes (EN)
- 2 Einfach (beide Richtungen) notes (EN, German-fronted → flip)
- 3 French Word notes (FR, with 15-field structure)
- 1 Vocab (reversed) note with VocabID
- Decks: `English::Test`, `Français::Test`, `Français::Französisch 5000::1. FR → DE`
- One note with no sentences (edge case)

### Unit tests

- Parser: correct field extraction for each note type
- Parser: language detection from deck names
- Parser: sentence limiting (5 max)
- Parser: HTML stripping and bold conversion
- Parser: French Word `*word*` → `**word**` conversion
- Parser: Einfach notes flipped correctly
- Parser: French Word dedup (2 cards → 1 note)
- Parser: skips decks not under English/Français
- Analysis: categorizes new/unchanged/updated correctly

### Integration tests

- Import creates decks and words in DB
- Re-import skips unchanged words
- Re-import updates changed words
- Vocab sync-back updates existing words
- Deck reassignment creates new deck and updates word

### E2e tests

- Upload file → see analysis → confirm → words appear in word list
- Upload file → cancel → no changes

## Capacity & Performance

- **Supabase free tier**: 500 MB storage — ~10k words ≈ 5-10 MB (well within limits)
- **Client-side parsing**: sql.js + fzstd handles 30 MB SQLite in seconds
- **DB inserts**: batch insert (100 rows per request) ≈ 50 requests for 5k words
- **Expected total import time**: 10-30 seconds

## Open Questions

1. **`fzstd` lazy loading**: load the zstd library only when navigating to the import page. Nice to have but not critical for initial implementation.
2. **Einfach notes**: confirmed — flip so non-German language is the source word.
