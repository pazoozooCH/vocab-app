import type { Word } from '../../domain/entities/Word'
import type { WordRepository } from '../ports/WordRepository'
import type { DeckRepository } from '../ports/DeckRepository'
import type { ParsedNote } from '../../infrastructure/anki/parseApkg'

export type ImportCategory = 'new' | 'unchanged' | 'updated' | 'vocab-sync'

export interface CategorizedNote {
  note: ParsedNote
  category: ImportCategory
  /** For updated/vocab-sync: the existing word that will be modified */
  existingWord?: Word
  /** For updated/vocab-sync: what changed */
  changes?: string[]
}

export interface ImportAnalysis {
  categorized: CategorizedNote[]
  summary: ImportSummary
}

export interface ImportSummary {
  total: number
  newCount: number
  unchangedCount: number
  updatedCount: number
  vocabSyncCount: number
  byLanguage: Record<string, number>
  byNoteType: Record<string, number>
  skippedDecks: string[]
  /** Deck names that will need to be created */
  newDecks: string[]
}

export async function analyzeImport(
  notes: ParsedNote[],
  skippedDecks: string[],
  userId: string,
  deps: { wordRepository: WordRepository; deckRepository: DeckRepository },
): Promise<ImportAnalysis> {
  // Fetch existing data for comparison
  const allGuids = notes.map((n) => n.guid).filter(Boolean)
  const existingByGuid = new Map<string, Word>()

  if (allGuids.length > 0) {
    const existing = await deps.wordRepository.findByAnkiGuids(allGuids, userId)
    for (const word of existing) {
      if (word.ankiGuid) existingByGuid.set(word.ankiGuid, word)
    }
  }

  // For Vocab (reversed) notes, also fetch by VocabID
  const vocabNotes = notes.filter((n) => n.vocabId)
  const vocabIds = vocabNotes.map((n) => n.vocabId!)
  const existingByVocabId = new Map<string, Word>()

  if (vocabIds.length > 0) {
    const existing = await deps.wordRepository.findByIds(vocabIds, userId)
    for (const word of existing) {
      existingByVocabId.set(word.id, word)
    }
  }

  // Find which decks already exist — build name→id map for deck change detection
  const existingDecks = await deps.deckRepository.findAllByUser(userId)
  const existingDeckNames = new Set(existingDecks.map((d) => d.name))
  const deckIdToName = new Map<string, string>()
  for (const deck of existingDecks) {
    deckIdToName.set(deck.id, deck.name)
  }

  // Categorize each note
  const categorized: CategorizedNote[] = []

  for (const note of notes) {
    categorized.push(categorizeNote(note, existingByGuid, existingByVocabId, deckIdToName))
  }

  // Find new deck names
  const neededDecks = new Set<string>()
  for (const note of notes) {
    collectDeckHierarchy(note.deckName, neededDecks)
  }
  const newDecks = [...neededDecks].filter((name) => !existingDeckNames.has(name)).sort()

  // Build summary
  const summary = buildSummary(categorized, skippedDecks, newDecks)

  return { categorized, summary }
}

function categorizeNote(
  note: ParsedNote,
  existingByGuid: Map<string, Word>,
  existingByVocabId: Map<string, Word>,
  deckIdToName: Map<string, string>,
): CategorizedNote {
  // Vocab (reversed) notes: match by VocabID first, then by guid
  if (note.vocabId) {
    const existing = existingByVocabId.get(note.vocabId) ?? existingByGuid.get(note.guid)
    if (existing) {
      const changes = detectChanges(note, existing, deckIdToName)
      if (changes.length === 0) {
        return { note, category: 'unchanged', existingWord: existing }
      }
      return { note, category: 'vocab-sync', existingWord: existing, changes }
    }
    // VocabID not found in DB — treat as new import
    return { note, category: 'new' }
  }

  // Other notes: match by anki_guid
  const existing = existingByGuid.get(note.guid)
  if (!existing) {
    return { note, category: 'new' }
  }

  const changes = detectChanges(note, existing, deckIdToName)
  if (changes.length === 0) {
    return { note, category: 'unchanged', existingWord: existing }
  }
  return { note, category: 'updated', existingWord: existing, changes }
}

function detectChanges(note: ParsedNote, existing: Word, deckIdToName: Map<string, string>): string[] {
  const changes: string[] = []

  if (normalizeForCompare(note.word) !== normalizeForCompare(existing.word)) {
    changes.push('word')
  }

  const noteTranslation = note.translations.join(', ')
  const existingTranslation = [...existing.translations].join(', ')
  if (normalizeForCompare(noteTranslation) !== normalizeForCompare(existingTranslation)) {
    changes.push('translation')
  }

  // Compare deck by resolving the existing word's deck ID to a name
  const existingDeckName = deckIdToName.get(existing.deckId)
  if (existingDeckName && note.deckName !== existingDeckName) {
    changes.push('deck')
  }

  return changes
}

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Collect all deck names in the hierarchy.
 * "English::Sub::Verbs" → ["English", "English::Sub", "English::Sub::Verbs"]
 */
function collectDeckHierarchy(deckName: string, result: Set<string>): void {
  const parts = deckName.split('::')
  for (let i = 1; i <= parts.length; i++) {
    result.add(parts.slice(0, i).join('::'))
  }
}

function buildSummary(
  categorized: CategorizedNote[],
  skippedDecks: string[],
  newDecks: string[],
): ImportSummary {
  const byLanguage: Record<string, number> = {}
  const byNoteType: Record<string, number> = {}

  let newCount = 0
  let unchangedCount = 0
  let updatedCount = 0
  let vocabSyncCount = 0

  for (const { note, category } of categorized) {
    switch (category) {
      case 'new': newCount++; break
      case 'unchanged': unchangedCount++; break
      case 'updated': updatedCount++; break
      case 'vocab-sync': vocabSyncCount++; break
    }

    byLanguage[note.language] = (byLanguage[note.language] ?? 0) + 1
    byNoteType[note.noteTypeName] = (byNoteType[note.noteTypeName] ?? 0) + 1
  }

  return {
    total: categorized.length,
    newCount,
    unchangedCount,
    updatedCount,
    vocabSyncCount,
    byLanguage,
    byNoteType,
    skippedDecks,
    newDecks,
  }
}
