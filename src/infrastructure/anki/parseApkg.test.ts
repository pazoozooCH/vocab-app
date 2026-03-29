import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import initSqlJs from 'sql.js'
import { parseApkg, stripHtml } from './parseApkg'
import type { ParsedNote } from './parseApkg'

const wasmPath = resolve(__dirname, '../../../node_modules/sql.js/dist/sql-wasm.wasm')

// ---- Synthetic .apkg builder ----

const FIELD_SEP = '\x1f'
const DECK_SEP = '\x1f' // Anki uses \x1f as deck hierarchy separator in DB

// Note type IDs matching what parseApkg expects
const BASIC_REVERSED_MODEL = 1727109230785
const EINFACH_MODEL = 1459520588346
const FRENCH_WORD_MODEL = 1683059128297
const VOCAB_REVERSED_MODEL = 1607392319100
const BASIC_MODEL = 1727109230784

interface SyntheticNote {
  guid: string
  modelId: number
  fields: string
  deckId: number
}

async function buildTestApkg(options: {
  decks: { id: number; name: string }[]
  models: { id: number; name: string }[]
  notes: SyntheticNote[]
  cards: { noteId: number; deckId: number; ord: number }[]
  useAnki21b?: boolean
}): Promise<Blob> {
  const { decks, models, notes, cards, useAnki21b = false } = options
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  const db = new SQL.Database()
  const now = Math.floor(Date.now() / 1000)

  // Create Anki schema
  db.run(`CREATE TABLE col (
    id integer primary key, crt integer, mod integer, scm integer, ver integer,
    dty integer, usn integer, ls integer, conf text, models text, decks text,
    dconf text, tags text
  )`)
  db.run(`CREATE TABLE notes (
    id integer primary key, guid text, mid integer, mod integer, usn integer,
    tags text, flds text, sfld integer, csum integer, flags integer, data text
  )`)
  db.run(`CREATE TABLE cards (
    id integer primary key, nid integer, did integer, ord integer, mod integer,
    usn integer, type integer, queue integer, due integer, ivl integer,
    factor integer, reps integer, lapses integer, left integer, odue integer,
    odid integer, flags integer, data text
  )`)
  db.run('CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer)')
  db.run('CREATE TABLE graves (usn integer, oid integer, type integer)')

  // Build deck JSON
  const deckEntries: Record<string, unknown> = {
    '1': { id: 1, name: 'Default', mod: now, usn: -1 },
  }
  for (const deck of decks) {
    deckEntries[String(deck.id)] = { id: deck.id, name: deck.name, mod: now, usn: -1 }
  }

  // Build model JSON
  const modelEntries: Record<string, unknown> = {}
  for (const model of models) {
    modelEntries[String(model.id)] = { id: model.id, name: model.name, mod: now, usn: -1 }
  }

  db.run('INSERT INTO col VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
    1, now, now, now * 1000, 11, 0, 0, 0, '{}',
    JSON.stringify(modelEntries), JSON.stringify(deckEntries), '{}', '{}',
  ])

  // Insert notes
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    const noteId = 1000 + i
    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [
      noteId, n.guid, n.modelId, now, -1, '', n.fields, 0, 0, 0, '',
    ])
  }

  // Insert cards
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      2000 + i, c.noteId, c.deckId, c.ord, now, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ])
  }

  const dbData = db.export()
  db.close()

  const collectionData = new Uint8Array(dbData)
  const mediaData = new TextEncoder().encode('{}')

  if (useAnki21b) {
    // For anki21b, we need zstd compression. Since fzstd only decompresses,
    // we'll create a minimal zstd frame manually.
    // Actually, let's just use both files — the parser prefers anki21b.
    // For testing, we'll use the anki2 path (no compression needed).
    // We can test the ZIP reading with anki2 format.
  }

  return createTestZip([
    { name: 'collection.anki2', data: collectionData },
    { name: 'media', data: mediaData },
  ])
}

function createTestZip(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const parts: ArrayBuffer[] = []
  const cdParts: ArrayBuffer[] = []
  let offset = 0
  let cdSize = 0

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name)
    const crc = crc32(file.data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, file.data.length, true)
    lv.setUint32(22, file.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    localHeader.set(nameBytes, 30)

    parts.push(localHeader.buffer as ArrayBuffer)
    parts.push(file.data.buffer.slice(0) as ArrayBuffer)

    const cdEntry = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cdEntry.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, file.data.length, true)
    cv.setUint32(24, file.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cdEntry.set(nameBytes, 46)

    cdParts.push(cdEntry.buffer)
    cdSize += cdEntry.byteLength
    offset += localHeader.byteLength + file.data.byteLength
  }

  const cdOffset = offset
  for (const entry of cdParts) parts.push(entry)

  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdOffset, true)
  parts.push(eocd.buffer)

  return new Blob(parts, { type: 'application/zip' })
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ---- Test data ----

const EN_DECK = { id: 100, name: `English${DECK_SEP}Test` }
const FR_DECK = { id: 200, name: `Français${DECK_SEP}Test` }
const FR_5000_FR_DE = { id: 301, name: `Français${DECK_SEP}Französisch 5000${DECK_SEP}1. FR → DE` }
const FR_5000_DE_FR = { id: 302, name: `Français${DECK_SEP}Französisch 5000${DECK_SEP}2. DE → FR` }
const GERMAN_DECK = { id: 400, name: `C1-C2 German-English` }

const ALL_MODELS = [
  { id: BASIC_REVERSED_MODEL, name: 'Basic (and reversed card)' },
  { id: EINFACH_MODEL, name: 'Einfach (beide Richtungen)' },
  { id: FRENCH_WORD_MODEL, name: 'French Word' },
  { id: VOCAB_REVERSED_MODEL, name: 'Vocab (reversed)' },
  { id: BASIC_MODEL, name: 'Basic' },
]

// Standard note: word<br><ol><li>sentence</li></ol>\x1fTranslation<br><ol><li>German sentence</li></ol>
function makeBasicFields(word: string, translation: string, sentences?: { source: string[]; german: string[] }): string {
  let front = word
  let back = translation
  if (sentences) {
    const srcLis = sentences.source.map((s) => `<li>${s}</li>`).join('')
    const deLis = sentences.german.map((s) => `<li>${s}</li>`).join('')
    front = `${word}<br><ol>${srcLis}</ol>`
    back = `${translation}<br><ol>${deLis}</ol>`
  }
  return `${front}${FIELD_SEP}${back}`
}

// French Word: 15 fields separated by \x1f
function makeFrenchWordFields(opts: {
  rang?: string
  wort?: string
  wortMitArtikel: string
  definition: string
  beispielsaetze?: string
}): string {
  const fields = new Array(15).fill('')
  fields[0] = opts.rang ?? '1'
  fields[1] = opts.wort ?? opts.wortMitArtikel.replace(/^(un|une|le|la|l')\s*/i, '')
  fields[2] = opts.wortMitArtikel
  fields[6] = opts.definition
  fields[7] = opts.beispielsaetze ?? ''
  return fields.join(FIELD_SEP)
}

// Vocab (reversed): Front\x1fBack\x1fVocabID
function makeVocabFields(front: string, back: string, vocabId: string): string {
  return `${front}${FIELD_SEP}${back}${FIELD_SEP}${vocabId}`
}

// ---- Helpers ----

async function buildStandardTestApkg(): Promise<Blob> {
  const notes: SyntheticNote[] = [
    // 3 Basic (and reversed) notes — English
    {
      guid: 'basic-en-1',
      modelId: BASIC_REVERSED_MODEL,
      fields: makeBasicFields(
        'resilient',
        'widerstandsfähig',
        { source: ['The system is <b>resilient</b>.', 'She showed a <b>resilient</b> spirit.'], german: ['Das System ist <b>widerstandsfähig</b>.', 'Sie zeigte einen <b>widerstandsfähigen</b> Geist.'] },
      ),
      deckId: EN_DECK.id,
    },
    {
      guid: 'basic-en-2',
      modelId: BASIC_REVERSED_MODEL,
      fields: makeBasicFields('obsolete', 'veraltet'),
      deckId: EN_DECK.id,
    },
    {
      guid: 'basic-en-3',
      modelId: BASIC_REVERSED_MODEL,
      fields: makeBasicFields(
        'ubiquitous',
        'allgegenwärtig',
        { source: ['Smartphones are <b>ubiquitous</b>.'], german: ['Smartphones sind <b>allgegenwärtig</b>.'] },
      ),
      deckId: EN_DECK.id,
    },
    // 2 Einfach (beide Richtungen) notes — English (German on front → must flip)
    {
      guid: 'einfach-1',
      modelId: EINFACH_MODEL,
      fields: makeBasicFields(
        'hartnäckig', // German on front (Vorderseite)
        'tenacious',  // English on back (Rückseite)
        { source: ['Er ist <b>hartnäckig</b>.'], german: ['He is <b>tenacious</b>.'] },
      ),
      deckId: EN_DECK.id,
    },
    {
      guid: 'einfach-2',
      modelId: EINFACH_MODEL,
      fields: makeBasicFields('gelassen', 'serene'),
      deckId: EN_DECK.id,
    },
    // 3 French Word notes — Français (2 cards each in FR→DE and DE→FR sub-decks)
    {
      guid: 'french-1',
      modelId: FRENCH_WORD_MODEL,
      fields: makeFrenchWordFields({
        wortMitArtikel: 'la politique',
        definition: 'die Politik',
        beispielsaetze: 'Vive *la* politique, vive *l\'*amour.\nEs lebe *die* Politik, es lebe *die* Liebe.\n\n*Le* chien de mon voisin aboie toute la nuit.\n*Der* Hund meines Nachbarn bellt die ganze Nacht.',
      }),
      deckId: FR_5000_FR_DE.id,
    },
    {
      guid: 'french-2',
      modelId: FRENCH_WORD_MODEL,
      fields: makeFrenchWordFields({
        wortMitArtikel: 'un bus',
        definition: 'der Bus',
      }),
      deckId: FR_5000_FR_DE.id,
    },
    {
      guid: 'french-3',
      modelId: FRENCH_WORD_MODEL,
      fields: makeFrenchWordFields({
        wortMitArtikel: "l'eau (f.)",
        definition: 'das Wasser',
        beispielsaetze: "Je bois de *l'eau* tous les jours.\nIch trinke jeden Tag *Wasser*.\n\n*L'eau* est essentielle à la vie.\n*Wasser* ist lebenswichtig.\n\nIl y a de *l'eau* dans le verre.\nEs ist *Wasser* im Glas.\n\n*L'eau* coule du robinet.\n*Das Wasser* fließt aus dem Hahn.\n\nNous manquons *d'eau* potable.\nUns fehlt *Trinkwasser*.\n\nJe nage dans *l'eau* froide.\nIch schwimme in kaltem *Wasser*.",
      }),
      deckId: FR_5000_FR_DE.id,
    },
    // 1 Vocab (reversed) note with VocabID — uses our export HTML format
    {
      guid: 'vocab-1',
      modelId: VOCAB_REVERSED_MODEL,
      fields: makeVocabFields(
        'battery <i>[Law]</i><br><ol><li><b>Battery</b> is a criminal offense.</li><li>He was charged with <b>battery</b>.</li></ol>',
        'Batterie <i>[Tech]</i>, Körperverletzung <i>[Law]</i><br><ol><li><b>Batterie</b> ist eine Straftat.</li><li>Er wurde wegen <b>Körperverletzung</b> angeklagt.</li></ol>',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      ),
      deckId: EN_DECK.id,
    },
    // 1 note in a skipped deck (German)
    {
      guid: 'german-1',
      modelId: BASIC_MODEL,
      fields: makeBasicFields('Haus', 'house'),
      deckId: GERMAN_DECK.id,
    },
  ]

  const cards = [
    // Basic notes: 1 card each (for reversed, Anki creates 2 but we only need 1 for import)
    { noteId: 1000, deckId: EN_DECK.id, ord: 0 },
    { noteId: 1001, deckId: EN_DECK.id, ord: 0 },
    { noteId: 1002, deckId: EN_DECK.id, ord: 0 },
    // Einfach notes
    { noteId: 1003, deckId: EN_DECK.id, ord: 0 },
    { noteId: 1004, deckId: EN_DECK.id, ord: 0 },
    // French Word notes: 2 cards each (FR→DE and DE→FR sub-decks)
    { noteId: 1005, deckId: FR_5000_FR_DE.id, ord: 0 },
    { noteId: 1005, deckId: FR_5000_DE_FR.id, ord: 1 },
    { noteId: 1006, deckId: FR_5000_FR_DE.id, ord: 0 },
    { noteId: 1006, deckId: FR_5000_DE_FR.id, ord: 1 },
    { noteId: 1007, deckId: FR_5000_FR_DE.id, ord: 0 },
    { noteId: 1007, deckId: FR_5000_DE_FR.id, ord: 1 },
    // Vocab (reversed)
    { noteId: 1008, deckId: EN_DECK.id, ord: 0 },
    // German deck (skipped)
    { noteId: 1009, deckId: GERMAN_DECK.id, ord: 0 },
  ]

  return buildTestApkg({
    decks: [EN_DECK, FR_DECK, FR_5000_FR_DE, FR_5000_DE_FR, GERMAN_DECK],
    models: ALL_MODELS,
    notes,
    cards,
  })
}

// ---- Tests ----

describe('parseApkg', () => {
  let result: Awaited<ReturnType<typeof parseApkg>>

  // Parse once and reuse across tests
  async function getResult(): Promise<typeof result> {
    if (!result) {
      const blob = await buildStandardTestApkg()
      result = await parseApkg(blob, wasmPath)
    }
    return result
  }

  function findNote(guid: string): ParsedNote | undefined {
    return result?.notes.find((n) => n.guid === guid)
  }

  it('parses the correct number of notes (excluding skipped decks)', async () => {
    const r = await getResult()
    // 3 basic + 2 einfach + 3 french + 1 vocab = 9 (1 german skipped)
    expect(r.notes).toHaveLength(9)
  })

  it('reports skipped decks', async () => {
    const r = await getResult()
    expect(r.skippedDecks).toContain('C1-C2 German-English')
  })

  it('reports note type counts', async () => {
    const r = await getResult()
    expect(r.noteTypeCounts['Basic (and reversed card)']).toBe(3)
    expect(r.noteTypeCounts['Einfach (beide Richtungen)']).toBe(2)
    expect(r.noteTypeCounts['French Word']).toBe(3)
    expect(r.noteTypeCounts['Vocab (reversed)']).toBe(1)
  })

  describe('Basic (and reversed card) notes', () => {
    it('extracts word and translation from HTML fields', async () => {
      await getResult()
      const note = findNote('basic-en-1')!
      expect(note).toBeDefined()
      expect(note.word).toBe('resilient')
      expect(note.translations).toEqual(['widerstandsfähig'])
    })

    it('extracts sentences from <li> elements', async () => {
      await getResult()
      const note = findNote('basic-en-1')!
      expect(note.sentencesSource).toHaveLength(2)
      expect(note.sentencesSource[0]).toContain('resilient')
      expect(note.sentencesGerman).toHaveLength(2)
      expect(note.sentencesGerman[0]).toContain('widerstandsfähig')
    })

    it('handles notes with no sentences', async () => {
      await getResult()
      const note = findNote('basic-en-2')!
      expect(note.word).toBe('obsolete')
      expect(note.translations).toEqual(['veraltet'])
      expect(note.sentencesSource).toEqual([])
      expect(note.sentencesGerman).toEqual([])
    })

    it('detects language as EN from English deck', async () => {
      await getResult()
      const note = findNote('basic-en-1')!
      expect(note.language).toBe('EN')
    })

    it('sets deck name with :: separator', async () => {
      await getResult()
      const note = findNote('basic-en-1')!
      expect(note.deckName).toBe('English::Test')
    })
  })

  describe('Einfach (beide Richtungen) notes', () => {
    it('flips fields: Back becomes source word, Front becomes German', async () => {
      await getResult()
      const note = findNote('einfach-1')!
      expect(note).toBeDefined()
      // German is on front (Vorderseite) → flipped so English is the source
      expect(note.word).toBe('tenacious')
      expect(note.translations).toEqual(['hartnäckig'])
    })

    it('flips sentences correctly', async () => {
      await getResult()
      const note = findNote('einfach-1')!
      // After flip: source sentences come from Back (Rückseite), German from Front
      expect(note.sentencesSource[0]).toContain('tenacious')
      expect(note.sentencesGerman[0]).toContain('hartnäckig')
    })

    it('handles notes with no sentences after flip', async () => {
      await getResult()
      const note = findNote('einfach-2')!
      expect(note.word).toBe('serene')
      expect(note.translations).toEqual(['gelassen'])
    })
  })

  describe('French Word notes', () => {
    it('extracts word from field[2] (Wort mit Artikel)', async () => {
      await getResult()
      const note = findNote('french-1')!
      expect(note.word).toBe('la politique')
    })

    it('extracts translation from field[6] (Definition)', async () => {
      await getResult()
      const note = findNote('french-1')!
      expect(note.translations).toEqual(['die Politik'])
    })

    it('parses sentence pairs from field[7]', async () => {
      await getResult()
      const note = findNote('french-1')!
      expect(note.sentencesSource).toHaveLength(2)
      expect(note.sentencesGerman).toHaveLength(2)
    })

    it('converts *bold* markers to **bold**', async () => {
      await getResult()
      const note = findNote('french-1')!
      expect(note.sentencesSource[0]).toContain('**la**')
      expect(note.sentencesGerman[0]).toContain('**die**')
    })

    it('limits to 5 sentence pairs', async () => {
      await getResult()
      const note = findNote('french-3')!
      // Input has 6 sentence pairs, should be capped at 5
      expect(note.sentencesSource.length).toBeLessThanOrEqual(5)
      expect(note.sentencesGerman.length).toBeLessThanOrEqual(5)
    })

    it('handles notes with no sentences', async () => {
      await getResult()
      const note = findNote('french-2')!
      expect(note.word).toBe('un bus')
      expect(note.translations).toEqual(['der Bus'])
      expect(note.sentencesSource).toEqual([])
      expect(note.sentencesGerman).toEqual([])
    })

    it('deduplicates French Word notes (2 cards → 1 note)', async () => {
      await getResult()
      // french-1 has 2 cards in different sub-decks, but should appear only once
      const matches = result.notes.filter((n) => n.guid === 'french-1')
      expect(matches).toHaveLength(1)
    })

    it('uses parent deck for French Word notes', async () => {
      await getResult()
      const note = findNote('french-1')!
      // Should be "Français::Französisch 5000" not "...::1. FR → DE"
      expect(note.deckName).toBe('Français::Französisch 5000')
    })

    it('detects language as FR from Français deck', async () => {
      await getResult()
      const note = findNote('french-1')!
      expect(note.language).toBe('FR')
    })
  })

  describe('Vocab (reversed) notes', () => {
    it('extracts VocabID from field[2]', async () => {
      await getResult()
      const note = findNote('vocab-1')!
      expect(note.vocabId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    })

    it('preserves markdown formatting from our export', async () => {
      await getResult()
      const note = findNote('vocab-1')!
      expect(note.word).toBe('battery _[Law]_')
      expect(note.translations).toEqual(['Batterie _[Tech]_, Körperverletzung _[Law]_'])
    })

    it('restores ordinal prefixes and bold in sentences', async () => {
      await getResult()
      const note = findNote('vocab-1')!
      expect(note.sentencesSource).toEqual([
        '1. **Battery** is a criminal offense.',
        '2. He was charged with **battery**.',
      ])
      expect(note.sentencesGerman).toEqual([
        '1. **Batterie** ist eine Straftat.',
        '2. Er wurde wegen **Körperverletzung** angeklagt.',
      ])
    })
  })

  describe('deck filtering', () => {
    it('skips notes in decks not under English or Français', async () => {
      await getResult()
      // The German deck note should not be in the results
      const german = findNote('german-1')
      expect(german).toBeUndefined()
    })
  })
})

describe('stripHtml', () => {
  it('strips HTML tags', () => {
    expect(stripHtml('<b>hello</b> world')).toBe('hello world')
  })

  it('decodes HTML entities', () => {
    expect(stripHtml('fish &amp; chips')).toBe('fish & chips')
    expect(stripHtml('a &lt; b &gt; c')).toBe('a < b > c')
  })

  it('handles nested tags', () => {
    expect(stripHtml('<ol><li><b>word</b></li></ol>')).toBe('word')
  })
})
