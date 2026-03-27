import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import { generateApkg } from './generateApkg'
import { Word } from '../../domain/entities/Word'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'
import initSqlJs from 'sql.js'

const wasmPath = resolve(__dirname, '../../../node_modules/sql.js/dist/sql-wasm.wasm')

function makeWord(overrides: Partial<{ word: string; id: string }> = {}): Word {
  return Word.create({
    id: overrides.id ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    userId: 'user-1',
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo', 'grüß Gott _[Aust]_'],
    sentencesSource: ['1. **Hello**, how are you?', '2. She said **hello**.'],
    sentencesGerman: ['1. **Hallo**, wie geht es dir?', '2. Sie sagte **hallo**.'],
    deckId: 'deck-1',
    status: WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
  })
}

async function extractDb(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Find the SQLite header (starts with "SQLite format 3\0")
  // The ZIP contains collection.anki2 — parse the ZIP to extract it
  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  // Simple ZIP extraction: find the local file header for collection.anki2
  let offset = 0
  while (offset < bytes.length) {
    const sig = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
    if (sig !== 0x04034b50) break // not a local file header

    const view = new DataView(buffer, offset)
    const compSize = view.getUint32(18, true)
    const nameLen = view.getUint16(26, true)
    const extraLen = view.getUint16(28, true)
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLen))
    const dataStart = offset + 30 + nameLen + extraLen

    if (name === 'collection.anki2') {
      const dbBytes = bytes.slice(dataStart, dataStart + compSize)
      return new SQL.Database(dbBytes)
    }

    offset = dataStart + compSize
  }
  throw new Error('collection.anki2 not found in apkg')
}

describe('generateApkg', () => {
  it('generates a valid apkg with correct structure', async () => {
    const words = [makeWord()]
    const blob = await generateApkg(words, 'English::Test', wasmPath)

    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBeGreaterThan(0)

    const db = await extractDb(blob)

    // Check col table
    const col = db.exec('SELECT * FROM col')
    expect(col).toHaveLength(1)
    expect(col[0].values).toHaveLength(1)

    // Check decks JSON contains the deck hierarchy
    const decksJson = JSON.parse(col[0].values[0][10] as string)
    const deckNames = Object.values(decksJson).map((d: unknown) => (d as { name: string }).name)
    expect(deckNames).toContain('Default')
    // Hierarchical decks use \x1f separator
    expect(deckNames.some((n: string) => n.includes('English'))).toBe(true)
    expect(deckNames.some((n: string) => n.includes('Test'))).toBe(true)

    // Check model has originalStockKind to merge with existing note type
    const modelsJson = JSON.parse(col[0].values[0][9] as string)
    const model = Object.values(modelsJson)[0] as { name: string; originalStockKind: number; tmpls: unknown[] }
    expect(model.name).toBe('Basic (and reversed card)')
    expect(model.originalStockKind).toBe(1)
    expect(model.tmpls).toHaveLength(2)

    db.close()
  })

  it('creates correct notes with HTML formatting', async () => {
    const words = [makeWord({ word: 'hello' })]
    const blob = await generateApkg(words, 'English::Test', wasmPath)
    const db = await extractDb(blob)

    const notes = db.exec('SELECT flds, sfld FROM notes')
    expect(notes[0].values).toHaveLength(1)

    const flds = notes[0].values[0][0] as string
    const [front, back] = flds.split('\x1f')

    // Front should contain the word and source sentences with HTML bold
    expect(front).toContain('<b>hello</b>')
    expect(front).toContain('<b>Hello</b>')

    // Back should contain translations with HTML formatting
    expect(back).toContain('hallo')
    expect(back).toContain('<i>[Aust]</i>')
    expect(back).toContain('<b>Hallo</b>')

    // sfld should be the plain word
    expect(notes[0].values[0][1]).toBe('hello')

    db.close()
  })

  it('creates 2 cards per note (forward and reversed)', async () => {
    const words = [makeWord()]
    const blob = await generateApkg(words, 'English::Test', wasmPath)
    const db = await extractDb(blob)

    const cards = db.exec('SELECT nid, ord FROM cards')
    expect(cards[0].values).toHaveLength(2)
    expect(cards[0].values[0][1]).toBe(0) // Card 1: forward
    expect(cards[0].values[1][1]).toBe(1) // Card 2: reversed

    // Both cards should reference the same note
    expect(cards[0].values[0][0]).toBe(cards[0].values[1][0])

    db.close()
  })

  it('creates multiple notes for multiple words', async () => {
    const words = [
      makeWord({ id: 'id-1', word: 'hello' }),
      makeWord({ id: 'id-2', word: 'goodbye' }),
    ]
    const blob = await generateApkg(words, 'English::Test', wasmPath)
    const db = await extractDb(blob)

    const notes = db.exec('SELECT COUNT(*) FROM notes')
    expect(notes[0].values[0][0]).toBe(2)

    const cards = db.exec('SELECT COUNT(*) FROM cards')
    expect(cards[0].values[0][0]).toBe(4) // 2 cards per note

    db.close()
  })

  it('assigns cards to the correct leaf deck', async () => {
    const words = [makeWord()]
    const blob = await generateApkg(words, 'English::Sub::Deep', wasmPath)
    const db = await extractDb(blob)

    // Should have created deck hierarchy: Default, English, English\x1fSub, English\x1fSub\x1fDeep
    const decksJson = JSON.parse(db.exec('SELECT decks FROM col')[0].values[0][0] as string)
    const deckList = Object.values(decksJson) as Array<{ id: number; name: string }>
    expect(deckList.length).toBeGreaterThanOrEqual(4) // Default + 3 hierarchy levels

    // Find the leaf deck
    const leafDeck = deckList.find((d) => d.name === 'English\x1fSub\x1fDeep')
    expect(leafDeck).toBeDefined()

    // Cards should be assigned to the leaf deck
    const cards = db.exec('SELECT did FROM cards')
    for (const row of cards[0].values) {
      expect(row[0]).toBe(leafDeck!.id)
    }

    db.close()
  })
})
