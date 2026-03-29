import initSqlJs from 'sql.js'
import { decompress } from 'fzstd'
import type { Language } from '../../domain/values/Language'

/** A parsed note from an Anki .apkg file, ready for import analysis */
export interface ParsedNote {
  /** Anki note guid — used for duplicate detection across imports */
  guid: string
  /** The source word (EN or FR) */
  word: string
  /** German translations */
  translations: string[]
  /** Source language sentences */
  sentencesSource: string[]
  /** German sentences */
  sentencesGerman: string[]
  /** Detected language from deck name */
  language: Language
  /** Deck name using :: separator (e.g. "English::Games") */
  deckName: string
  /** Note type name (e.g. "Basic (and reversed card)") */
  noteTypeName: string
  /** VocabID if this is a "Vocab (reversed)" note we exported */
  vocabId: string | null
}

export interface ParseResult {
  notes: ParsedNote[]
  /** Decks that were skipped (not under English/Français) */
  skippedDecks: string[]
  /** Stats by note type */
  noteTypeCounts: Record<string, number>
}

const FIELD_SEPARATOR = '\x1f'
const FRENCH_WORD_MODEL_ID = 1683059128297
const VOCAB_REVERSED_MODEL_ID = 1607392319100
const MAX_SENTENCES = 5

/**
 * Parse an Anki .apkg file and extract words for import.
 *
 * The .apkg is a ZIP containing:
 * - collection.anki21b (zstd-compressed SQLite) — the real data in modern exports
 * - collection.anki2 (legacy stub, ignored)
 * - media (JSON mapping, ignored)
 */
export async function parseApkg(
  file: File | Blob,
  wasmUrl?: string,
): Promise<ParseResult> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const entries = readZipEntries(buffer)

  // Prefer anki21b (zstd-compressed), fall back to anki2
  const anki21b = entries.find((e) => e.name === 'collection.anki21b')
  const anki2 = entries.find((e) => e.name === 'collection.anki2')

  let dbBytes: Uint8Array
  if (anki21b) {
    dbBytes = decompress(anki21b.data)
  } else if (anki2) {
    dbBytes = anki2.data
  } else {
    throw new Error('Invalid .apkg: no collection database found')
  }

  const SQL = await initSqlJs(
    wasmUrl !== undefined ? { locateFile: () => wasmUrl } : undefined,
  )
  const db = new SQL.Database(dbBytes)

  try {
    return extractNotes(db)
  } finally {
    db.close()
  }
}

interface DeckInfo {
  name: string
  language: Language | null
}

interface NoteTypeInfo {
  name: string
  id: number
}

interface AnkiDb {
  exec(sql: string): { columns: string[]; values: unknown[][] }[]
}

function hasTable(db: AnkiDb, tableName: string): boolean {
  const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`)
  return result.length > 0 && result[0].values.length > 0
}

function extractNotes(db: AnkiDb): ParseResult {
  const deckMap = new Map<number, DeckInfo>()
  const skippedDecks: string[] = []
  const noteTypeMap = new Map<number, NoteTypeInfo>()

  // Modern anki21b has separate `decks` and `notetypes` tables.
  // Legacy anki2 stores them as JSON in the `col` table's `decks`/`models` columns.
  const isModernFormat = hasTable(db, 'notetypes')

  if (isModernFormat) {
    // Read decks from the dedicated table
    const deckRows = db.exec('SELECT id, name FROM decks')
    if (deckRows.length > 0) {
      for (const row of deckRows[0].values) {
        const id = row[0] as number
        const name = (row[1] as string).replaceAll(FIELD_SEPARATOR, '::')
        const language = detectLanguage(name)
        if (language === null && name !== 'Default') {
          skippedDecks.push(name)
        }
        deckMap.set(id, { name, language })
      }
    }

    // Read note types from the dedicated table
    const ntRows = db.exec('SELECT id, name FROM notetypes')
    if (ntRows.length > 0) {
      for (const row of ntRows[0].values) {
        const id = row[0] as number
        const name = row[1] as string
        noteTypeMap.set(id, { name, id })
      }
    }
  } else {
    // Legacy format: JSON blobs in col table
    const colResult = db.exec('SELECT decks, models FROM col')
    if (colResult.length === 0) throw new Error('Invalid Anki database: no col table')

    const decksStr = colResult[0].values[0][0] as string
    if (decksStr) {
      const decksJson = JSON.parse(decksStr) as Record<string, { name: string; id: number }>
      for (const [, deck] of Object.entries(decksJson)) {
        const name = deck.name.replaceAll(FIELD_SEPARATOR, '::')
        const language = detectLanguage(name)
        if (language === null && name !== 'Default') {
          skippedDecks.push(name)
        }
        deckMap.set(deck.id, { name, language })
      }
    }

    const modelsStr = colResult[0].values[0][1] as string
    if (modelsStr) {
      const models = JSON.parse(modelsStr) as Record<string, { name: string; id: number }>
      for (const [, model] of Object.entries(models)) {
        noteTypeMap.set(model.id, { name: model.name, id: model.id })
      }
    }
  }

  // Get all cards to map note → deck (need to pick one deck per note for multi-card notes)
  const cardRows = db.exec('SELECT nid, did FROM cards')
  const noteDeckMap = new Map<number, number>() // noteId → deckId
  if (cardRows.length > 0) {
    for (const row of cardRows[0].values) {
      const nid = row[0] as number
      const did = row[1] as number
      // For notes with multiple cards (e.g. French Word), keep the first card's deck
      // unless the current one is a parent deck (shorter name = higher in hierarchy)
      if (!noteDeckMap.has(nid)) {
        noteDeckMap.set(nid, did)
      } else {
        const existingDeck = deckMap.get(noteDeckMap.get(nid)!)
        const newDeck = deckMap.get(did)
        if (existingDeck && newDeck && newDeck.name.length < existingDeck.name.length) {
          noteDeckMap.set(nid, did)
        }
      }
    }
  }

  // Get all notes
  const noteRows = db.exec('SELECT id, guid, mid, flds FROM notes')
  if (noteRows.length === 0) return { notes: [], skippedDecks, noteTypeCounts: {} }

  const notes: ParsedNote[] = []
  const noteTypeCounts: Record<string, number> = {}
  const seenGuids = new Set<string>()

  for (const row of noteRows[0].values) {
    const noteId = row[0] as number
    const guid = row[1] as string
    const modelId = row[2] as number
    const flds = row[3] as string

    // Deduplicate by guid (French Word notes have 2 cards)
    if (seenGuids.has(guid)) continue
    seenGuids.add(guid)

    // Find which deck this note belongs to
    const deckId = noteDeckMap.get(noteId)
    if (deckId === undefined) continue

    const deckInfo = deckMap.get(deckId)
    if (!deckInfo || deckInfo.language === null) continue // Skip non-English/Français decks

    const noteType = noteTypeMap.get(modelId)
    if (!noteType) continue

    // For French Word notes with cards in sub-decks, use the parent deck
    let deckName = deckInfo.name
    if (modelId === FRENCH_WORD_MODEL_ID) {
      deckName = getFrenchWordParentDeck(deckName)
    }

    const typeName = noteType.name
    noteTypeCounts[typeName] = (noteTypeCounts[typeName] ?? 0) + 1

    const parsed = parseNoteFields(flds, modelId, noteType.name, deckInfo.language, deckName, guid)
    if (parsed) {
      notes.push(parsed)
    }
  }

  return { notes, skippedDecks, noteTypeCounts }
}

/**
 * For French Word notes, cards are in sub-decks like:
 * "Français::Französisch 5000::1. FR → DE" and "...::2. DE → FR"
 * We want the parent: "Français::Französisch 5000"
 */
function getFrenchWordParentDeck(deckName: string): string {
  const parts = deckName.split('::')
  // If the last part looks like a direction indicator, remove it
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (/^\d+\.\s*(FR|DE|EN)\s*[→←]\s*(FR|DE|EN)$/i.test(last)) {
      return parts.slice(0, -1).join('::')
    }
  }
  return deckName
}

function detectLanguage(deckName: string): Language | null {
  const topLevel = deckName.split('::')[0]
  if (topLevel === 'English') return 'EN' as Language
  if (topLevel === 'Français') return 'FR' as Language
  return null
}

function parseNoteFields(
  flds: string,
  modelId: number,
  noteTypeName: string,
  language: Language,
  deckName: string,
  guid: string,
): ParsedNote | null {
  const fields = flds.split(FIELD_SEPARATOR)

  if (modelId === FRENCH_WORD_MODEL_ID) {
    return parseFrenchWord(fields, language, deckName, guid)
  }

  if (modelId === VOCAB_REVERSED_MODEL_ID) {
    return parseVocabReversed(fields, noteTypeName, language, deckName, guid)
  }

  // Standard 2-field notes: Basic, Einfach, Basic (and reversed card)
  return parseStandardNote(fields, noteTypeName, modelId, language, deckName, guid)
}

function parseFrenchWord(
  fields: string[],
  language: Language,
  deckName: string,
  guid: string,
): ParsedNote | null {
  if (fields.length < 8) return null

  const word = stripHtml(fields[2]).trim() // Wort mit Artikel
  const translation = stripHtml(fields[6]).trim() // Definition (German)
  if (!word || !translation) return null

  const sentences = parseFrenchWordSentences(fields[7])

  return {
    guid,
    word,
    translations: [translation],
    sentencesSource: sentences.source.slice(0, MAX_SENTENCES),
    sentencesGerman: sentences.german.slice(0, MAX_SENTENCES),
    language,
    deckName,
    noteTypeName: 'French Word',
    vocabId: null,
  }
}

/**
 * Parse French Word sentence pairs from field 7 (Beispielsätze).
 * Format: pairs separated by double newline, each pair is FR line + DE line.
 * *word* marks bold → convert to **word**.
 */
function parseFrenchWordSentences(raw: string): { source: string[]; german: string[] } {
  const source: string[] = []
  const german: string[] = []

  if (!raw.trim()) return { source, german }

  const cleaned = stripHtml(raw)
  const pairs = cleaned.split(/\n\n+/)

  for (const pair of pairs) {
    const lines = pair.trim().split('\n').filter((l) => l.trim())
    if (lines.length >= 2) {
      source.push(convertBold(lines[0].trim()))
      german.push(convertBold(lines[1].trim()))
    }
  }

  return { source, german }
}

/** Convert Anki's *word* bold markers to **word** markdown */
function convertBold(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '**$1**')
}

function parseVocabReversed(
  fields: string[],
  noteTypeName: string,
  language: Language,
  deckName: string,
  guid: string,
): ParsedNote | null {
  if (fields.length < 3) return null

  const frontHtml = fields[0]
  const backHtml = fields[1]
  const vocabId = fields[2].trim() || null

  const { word: sourceWord, sentences: sourceSentences } = parseHtmlField(frontHtml)
  const { word: germanWord, sentences: germanSentences } = parseHtmlField(backHtml)

  if (!sourceWord || !germanWord) return null

  return {
    guid,
    word: sourceWord,
    translations: [germanWord],
    sentencesSource: sourceSentences.slice(0, MAX_SENTENCES),
    sentencesGerman: germanSentences.slice(0, MAX_SENTENCES),
    language,
    deckName,
    noteTypeName,
    vocabId,
  }
}

function parseStandardNote(
  fields: string[],
  noteTypeName: string,
  _modelId: number,
  language: Language,
  deckName: string,
  guid: string,
): ParsedNote | null {
  if (fields.length < 2) return null

  const field0Html = fields[0]
  const field1Html = fields[1]

  const field0 = parseHtmlField(field0Html)
  const field1 = parseHtmlField(field1Html)

  // "Einfach (beide Richtungen)" has German on the front — flip it
  const isEinfach = noteTypeName === 'Einfach (beide Richtungen)'

  const sourceField = isEinfach ? field1 : field0
  const germanField = isEinfach ? field0 : field1

  if (!sourceField.word || !germanField.word) return null

  return {
    guid,
    word: sourceField.word,
    translations: [germanField.word],
    sentencesSource: sourceField.sentences.slice(0, MAX_SENTENCES),
    sentencesGerman: germanField.sentences.slice(0, MAX_SENTENCES),
    language,
    deckName,
    noteTypeName,
    vocabId: null,
  }
}

/**
 * Parse an HTML field like: word<br><ol><li>Sentence one.</li><li>Sentence two.</li></ol>
 * Returns the word and extracted sentences.
 */
function parseHtmlField(html: string): { word: string; sentences: string[] } {
  if (!html.trim()) return { word: '', sentences: [] }

  // Split on first <br> (or <br/> or <br />)
  const brIndex = html.search(/<br\s*\/?\s*>/i)
  let wordPart: string
  let sentencePart: string

  if (brIndex === -1) {
    wordPart = html
    sentencePart = ''
  } else {
    wordPart = html.slice(0, brIndex)
    sentencePart = html.slice(brIndex)
  }

  const word = stripHtml(wordPart).trim()

  const sentences: string[] = []
  // Extract text from <li> tags
  const liRegex = /<li>(.*?)<\/li>/gi
  let match
  while ((match = liRegex.exec(sentencePart)) !== null) {
    const text = stripHtml(match[1]).trim()
    if (text) sentences.push(text)
  }

  return { word, sentences }
}

/** Strip all HTML tags from a string */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

// ---- Minimal ZIP reader (no external dependency) ----

interface ZipEntry {
  name: string
  data: Uint8Array
}

function readZipEntries(buffer: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = []
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // Find End of Central Directory
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found')

  const cdOffset = view.getUint32(eocdOffset + 16, true)
  const cdEntries = view.getUint16(eocdOffset + 10, true)

  let pos = cdOffset
  for (let i = 0; i < cdEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break

    const compressedSize = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localHeaderOffset = view.getUint32(pos + 42, true)

    const name = new TextDecoder().decode(buffer.slice(pos + 46, pos + 46 + nameLen))

    // Read data from local file header
    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const data = buffer.slice(dataStart, dataStart + compressedSize)

    entries.push({ name, data })

    pos += 46 + nameLen + extraLen + commentLen
  }

  return entries
}
