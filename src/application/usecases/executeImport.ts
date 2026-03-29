import { Word } from '../../domain/entities/Word'
import { Deck } from '../../domain/entities/Deck'
import { WordStatus } from '../../domain/values/WordStatus'
import type { Language } from '../../domain/values/Language'
import type { WordRepository } from '../ports/WordRepository'
import type { DeckRepository } from '../ports/DeckRepository'
import type { CategorizedNote } from './analyzeImport'

export interface ImportProgress {
  phase: 'decks' | 'inserting' | 'updating' | 'done'
  current: number
  total: number
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
}

export async function executeImport(
  categorized: CategorizedNote[],
  newDeckNames: string[],
  userId: string,
  deps: { wordRepository: WordRepository; deckRepository: DeckRepository },
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  // Phase 1: Create missing decks
  onProgress?.({ phase: 'decks', current: 0, total: newDeckNames.length })
  const deckNameToId = await createMissingDecks(newDeckNames, userId, deps.deckRepository)

  // Also map existing decks
  const existingDecks = await deps.deckRepository.findAllByUser(userId)
  for (const deck of existingDecks) {
    deckNameToId.set(deck.name, deck.id)
  }
  onProgress?.({ phase: 'decks', current: newDeckNames.length, total: newDeckNames.length })

  // Phase 2: Insert new words
  const newNotes = categorized.filter((c) => c.category === 'new')
  const newWords: Word[] = []
  for (const { note } of newNotes) {
    const deckId = deckNameToId.get(note.deckName)
    if (!deckId) continue

    newWords.push(Word.create({
      id: crypto.randomUUID(),
      userId,
      word: note.word,
      language: note.language,
      translations: note.translations,
      sentencesSource: note.sentencesSource,
      sentencesGerman: note.sentencesGerman,
      deckId,
      status: WordStatus.Imported,
      createdAt: new Date(),
      exportedAt: null,
      ankiGuid: note.guid,
    }))
  }

  const totalInserts = newWords.length
  const BATCH_SIZE = 100
  for (let i = 0; i < newWords.length; i += BATCH_SIZE) {
    const batch = newWords.slice(i, i + BATCH_SIZE)
    await deps.wordRepository.saveBatch(batch)
    onProgress?.({ phase: 'inserting', current: Math.min(i + BATCH_SIZE, totalInserts), total: totalInserts })
  }

  // Phase 3: Update changed words (updated + vocab-sync)
  const updatedNotes = categorized.filter((c) => c.category === 'updated' || c.category === 'vocab-sync')
  const updatedWords: Word[] = []
  for (const { note, existingWord } of updatedNotes) {
    if (!existingWord) continue

    const deckId = deckNameToId.get(note.deckName) ?? existingWord.deckId

    updatedWords.push(Word.create({
      id: existingWord.id,
      userId: existingWord.userId,
      word: note.word,
      language: note.language,
      translations: note.translations,
      sentencesSource: note.sentencesSource,
      sentencesGerman: note.sentencesGerman,
      deckId,
      status: existingWord.status,
      createdAt: existingWord.createdAt,
      exportedAt: existingWord.exportedAt,
      ankiGuid: note.guid,
    }))
  }

  if (updatedWords.length > 0) {
    await deps.wordRepository.updateBatch(updatedWords)
  }
  onProgress?.({ phase: 'updating', current: updatedWords.length, total: updatedWords.length })

  const skipped = categorized.filter((c) => c.category === 'unchanged').length

  onProgress?.({ phase: 'done', current: 0, total: 0 })

  return {
    added: newWords.length,
    updated: updatedWords.length,
    skipped,
  }
}

/**
 * Create decks that don't exist yet, respecting the hierarchy.
 * Sort by name length so parents are created before children.
 */
async function createMissingDecks(
  deckNames: string[],
  userId: string,
  deckRepository: DeckRepository,
): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>()

  // Sort by depth (fewer :: = higher in hierarchy)
  const sorted = [...deckNames].sort((a, b) => {
    const depthA = a.split('::').length
    const depthB = b.split('::').length
    return depthA - depthB || a.localeCompare(b)
  })

  for (const name of sorted) {
    const language = detectLanguageFromDeckName(name)
    if (!language) continue

    const id = crypto.randomUUID()
    const deck = Deck.create({ id, name, userId, language })
    await deckRepository.save(deck)
    nameToId.set(name, id)
  }

  return nameToId
}

function detectLanguageFromDeckName(name: string): Language | null {
  const topLevel = name.split('::')[0]
  if (topLevel === 'English') return 'EN' as Language
  if (topLevel === 'Français') return 'FR' as Language
  return null
}
