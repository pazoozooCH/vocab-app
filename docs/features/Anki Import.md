# Anki Import

Import existing Anki cards into the Vocab app for duplicate detection and vocabulary management.

## Goal

- Import words from an Anki `.apkg` export so they appear in the word list
- Detect duplicates when adding new words via the AI translation flow
- Imported words are read-only references — they were created in Anki, not in the app
- Support re-importing without creating duplicates

## Data Analysis

Analyzed from user's Anki export (March 2026, ~10,000 cards).

### Note Types

| ID | Name | Notes | Language | Import? |
|----|------|-------|----------|---------|
| 1727109230785 | Basic (and reversed card) | 4,091 | EN + FR | Yes |
| 1459520588346 | Einfach (beide Richtungen) | 673 | EN | Yes |
| 1683059128297 | French Word | 5,000 | FR | Yes |
| 1607392319100 | Vocab (reversed) | 85 | — | **Skip** (our own exports, have VocabID) |
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
*Le* chien de mon voisin aboie toute la nuit.
*Der* Hund meines Nachbarn bellt die ganze Nacht.

Elle *l'*aime depuis leur première rencontre.
Sie liebt *ihn* seit ihrer ersten Begegnung.
```

Parsing:
1. Split by double newline (`\n\n`) → sentence pairs
2. Each pair: first line = French, second line = German
3. `*word*` marks bold vocabulary words → convert to `**word**` (our markdown format)
4. Limit to 2-3 sentence pairs (some words have 50+)

#### Vocab (reversed) — Skip

Our own exports. Field 2 contains VocabID (UUID). Skip these entirely during import to avoid circular re-import.

### Deck Structure

Decks use `\x1f` as hierarchy separator (displayed as `::` in Anki UI).

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
C1-C2 German-English (audioacademy.eu)
```

**Important**: French Word notes have cards in **two** sub-decks (`FR → DE` and `DE → FR`). Each note produces 2 cards in different decks. Import the **note** once, not each card.

### Language Detection

Determine language from the **top-level** deck name of the card:
- `English*` → EN
- `Français*` → FR
- `C1-C2 German-English*` → EN
- Unknown → prompt user during import

## Database Changes

### New WordStatus value

Add `imported` to the `WordStatus` enum:
- `pending` — added via the app, not yet exported
- `exported` — added via the app, exported to Anki
- `imported` — imported from Anki, read-only reference

Migration: update the CHECK constraint on `words.status` to allow `'imported'`.

### New column: `anki_guid`

Add `anki_guid text` column to `words` table:
- Nullable (only set for imported words)
- Unique per user (prevents duplicate imports)
- Stores the Anki note `guid` (e.g. `B[LorXuOhh`)

Migration: `ALTER TABLE words ADD COLUMN anki_guid text`, add unique index on `(user_id, anki_guid)`.

### Deck mapping

Imported words need a deck. Options:
1. **Create decks automatically** from the Anki deck hierarchy
2. **Let user select** a target deck during import
3. **Map Anki decks** to existing Vocab decks

Recommendation: **Option 1** — auto-create decks matching the Anki hierarchy. The user can rename/reorganize after import. Use the top-level deck for language detection, and the most specific (leaf) deck for assignment.

## Implementation Plan

### Phase 1: Parser (`src/infrastructure/anki/parseApkg.ts`)

Client-side `.apkg` parser using sql.js:
1. Read ZIP → extract `collection.anki21b` (zstd) or `collection.anki2` (SQLite)
2. Query `notetypes`, `fields`, `notes`, `cards`, `decks`
3. For each note:
   - Determine note type and parse fields accordingly
   - Determine language from card's deck
   - Extract: word, translations, source sentences, German sentences
   - Store Anki guid for dedup
4. Return a list of parsed words with metadata

**Challenge**: `collection.anki21b` is zstd-compressed. Browser doesn't have native zstd. Options:
- Use `collection.anki2` (legacy format, always present) — simpler
- Add a zstd WASM library — more complex

Recommendation: use `collection.anki2` for now. It contains the same notes/cards data in the old JSON-in-col format.

Actually, from analysis: `collection.anki2` only has a stub "please update" message in newer exports. The real data is only in `collection.anki21b`. We'll need a zstd decompression library (e.g. `fzstd` — small, no WASM).

### Phase 2: Import Preview UI

New page or modal accessible from the word list or a dedicated nav item:
1. File upload (`.apkg` file)
2. Parse and show summary: X notes found, Y decks, Z already imported
3. Let user select which decks to import (checkboxes)
4. Show preview of first few words per deck
5. "Import" button

### Phase 3: Import Execution

1. Create decks that don't exist yet
2. For each word:
   - Check if `anki_guid` already exists → skip
   - Create Word entity with status `imported`
   - Save to DB
3. Show summary: X imported, Y skipped (duplicates), Z failed

### Phase 4: Duplicate Detection Integration

The existing `findDuplicates` method already checks by word text. Imported words will naturally appear as duplicates when adding new words via the AI flow.

No code changes needed — just having the imported words in the DB is sufficient.

## HTML Parsing Details

### Extracting word and sentences from Basic format

```
Input:  "abonder<br><ol><li>Les erreurs abondent dans ce texte.<br></li></ol>"
Output: { word: "abonder", sentences: ["Les erreurs abondent dans ce texte."] }
```

Steps:
1. Split on `<br>` (first occurrence) → word part + rest
2. Strip HTML from word part → plain text word
3. Find all `<li>` content via regex → sentence array
4. Strip `<br>` and other HTML from sentences
5. Handle edge case: no `<br>` or `<ol>` → word only, no sentences

### Extracting from French Word format

```
Field[2]: "le"               → word (with article)
Field[6]: "[bestimmter Artikel], ihn/sie/es"  → translations (comma-separated)
Field[7]: "Vive *la* politique...\nEs lebe *die* Politik...\n\n..."
          → sentence pairs split by \n\n, convert *word* to **word**
```

Steps:
1. Word: use field[2] ("Wort mit Artikel"), fallback to field[1]
2. Translations: split field[6] by `, ` or `,`
3. Sentences: split field[7] by `\n\n`, take first 3 pairs
4. Each pair: line 1 = source (FR), line 2 = German
5. Convert `*text*` → `**text**` for our bold format

## Open Questions

1. **Import page location**: new tab in bottom nav, or accessible from word list page via a button?
2. **Re-import behavior**: when re-importing an updated Anki export, should we update existing imported words or only add new ones?
3. **Sentence limit**: how many sentences to import for French Word notes? Suggest 3.
4. **Deck mapping for "Einfach" notes**: these are German-fronted (DE→EN). Should we flip them so the English word is the "source"?
5. **C1-C2 German-English deck**: this is a third-party deck. Import or skip?
6. **collection.anki2 vs anki21b**: need to verify if collection.anki2 has real data or just a stub in the user's export version.
