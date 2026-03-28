import initSqlJs from 'sql.js'
import type { Word } from '../../domain/entities/Word'

// Convert markdown bold (**text**) and italic (_text_) to HTML
function mdToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/_(\[.+?\])_/g, '<i>$1</i>')
}

// Strip ordinal prefixes (e.g. "1. ", "2. ") since we use <ol> for numbering
function stripOrdinal(text: string): string {
  return text.replace(/^\d+\.\s*/, '')
}

function formatFront(word: Word): string {
  const sentences = word.sentencesSource.map((s) => `<li>${mdToHtml(stripOrdinal(s))}</li>`).join('')
  return `${mdToHtml(word.word)}<br><ol>${sentences}</ol>`
}

function formatBack(word: Word): string {
  const translationText = word.translations.map(mdToHtml).join(', ')
  const sentences = word.sentencesGerman.map((s) => `<li>${mdToHtml(stripOrdinal(s))}</li>`).join('')
  return `${translationText}<br><ol>${sentences}</ol>`
}

// Generate a deterministic large positive ID from a string
function stringToId(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return 1600000000000 + Math.abs(hash) % 100000000
}

// Collect all deck names in the hierarchy
// In collection.anki2 JSON format, Anki uses :: as the hierarchy separator
// e.g. "English::Sub::Verbs" → ["English", "English::Sub", "English::Sub::Verbs"]
function allDeckNames(name: string): string[] {
  const parts = name.split('::')
  const result: string[] = []
  for (let i = 1; i <= parts.length; i++) {
    result.push(parts.slice(0, i).join('::'))
  }
  return result
}

interface WordWithDeck {
  word: Word
  deckName: string
}

export async function generateApkg(
  wordsWithDecks: WordWithDeck[],
  wasmUrl?: string,
): Promise<Blob> {
  const SQL = await initSqlJs(
    wasmUrl !== undefined ? { locateFile: () => wasmUrl } : undefined,
  )
  const db = new SQL.Database()

  const modelId = 1607392319100
  const now = Math.floor(Date.now() / 1000)

  // Create schema
  db.run(`CREATE TABLE col (
    id integer primary key, crt integer not null, mod integer not null,
    scm integer not null, ver integer not null, dty integer not null,
    usn integer not null, ls integer not null, conf text not null,
    models text not null, decks text not null, dconf text not null, tags text not null
  )`)
  db.run(`CREATE TABLE notes (
    id integer primary key, guid text not null, mid integer not null,
    mod integer not null, usn integer not null, tags text not null,
    flds text not null, sfld integer not null, csum integer not null,
    flags integer not null, data text not null
  )`)
  db.run(`CREATE TABLE cards (
    id integer primary key, nid integer not null, did integer not null,
    ord integer not null, mod integer not null, usn integer not null,
    type integer not null, queue integer not null, due integer not null,
    ivl integer not null, factor integer not null, reps integer not null,
    lapses integer not null, left integer not null, odue integer not null,
    odid integer not null, flags integer not null, data text not null
  )`)
  db.run(`CREATE TABLE revlog (
    id integer primary key, cid integer not null, usn integer not null,
    ease integer not null, ivl integer not null, lastIvl integer not null,
    factor integer not null, time integer not null, type integer not null
  )`)
  db.run('CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null)')

  // Collect all unique deck names from the words and build the hierarchy.
  // Use case-insensitive dedup: if "English::Test" and "English::test" both appear,
  // keep the first one seen to avoid Anki creating duplicate decks with "_" suffix.
  const seenLower = new Map<string, string>() // lowercase → first-seen casing
  const allDeckNamesSet = new Set<string>()
  const deckNameToAnkiId = new Map<string, number>()

  for (const { deckName } of wordsWithDecks) {
    for (const name of allDeckNames(deckName)) {
      const lower = name.toLowerCase()
      if (!seenLower.has(lower)) {
        seenLower.set(lower, name)
        allDeckNamesSet.add(name)
      }
    }
  }

  const deckEntries: Record<string, unknown> = {
    '1': {
      id: 1, name: 'Default', mod: now, usn: -1,
      lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
      collapsed: true, browserCollapsed: true, desc: '', dyn: 0, conf: 1,
      extendNew: 0, extendRev: 0,
    },
  }

  let firstLeafDeckId = 1
  for (const name of allDeckNamesSet) {
    const id = stringToId(name)
    deckNameToAnkiId.set(name, id)
    deckEntries[String(id)] = {
      id, name, mod: now, usn: -1,
      lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
      collapsed: false, browserCollapsed: false, desc: '', dyn: 0, conf: 1,
      extendNew: 10, extendRev: 50,
    }
    if (firstLeafDeckId === 1) firstLeafDeckId = id
  }

  // Custom note type with VocabID field for correlation with the Vocab app.
  // Uses a fixed model ID so re-imports update the same note type.
  // No originalStockKind — this is our own note type, separate from stock.
  const models = {
    [String(modelId)]: {
      id: modelId, name: 'Vocab (reversed)', type: 0,
      mod: now, usn: -1, sortf: 0, did: null,
      tmpls: [
        { name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}', bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 },
        { name: 'Card 2', ord: 1, qfmt: '{{Back}}', afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}', bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 },
      ],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, description: '', plainText: false, collapsed: false, excludeFromSearch: false, tag: null, preventDeletion: false },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, description: '', plainText: false, collapsed: false, excludeFromSearch: false, tag: null, preventDeletion: false },
        { name: 'VocabID', ord: 2, sticky: false, rtl: false, font: 'Arial', size: 20, description: 'Vocab app word ID for sync/correlation', plainText: true, collapsed: true, excludeFromSearch: false, tag: null, preventDeletion: true },
      ],
      css: '.card {\n    font-family: arial;\n    font-size: 20px;\n    line-height: 1.5;\n    text-align: center;\n    color: black;\n    background-color: white;\n}\n',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [0]], [1, 'any', [1]]],
      vers: [], tags: [],
    },
  }

  const conf = {
    nextPos: 1, estTimes: true, activeDecks: [1], curDeck: firstLeafDeckId,
    newSpread: 0, collapseTime: 1200, timeLim: 0, addToCur: true,
    curModel: String(modelId), dueCounts: true, sortType: 'noteFld', sortBackwards: false,
  }

  const dconf = {
    '1': {
      id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true,
      timer: 0, replayq: true,
      new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
      rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
    },
  }

  db.run('INSERT INTO col VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
    1, now, now, now * 1000, 11, 0, 0, 0,
    JSON.stringify(conf), JSON.stringify(models),
    JSON.stringify(deckEntries), JSON.stringify(dconf), '{}',
  ])

  // Add notes and cards — each word goes to its own deck
  for (let i = 0; i < wordsWithDecks.length; i++) {
    const { word, deckName } = wordsWithDecks[i]
    const noteId = now * 1000 + i
    const front = formatFront(word)
    const back = formatBack(word)
    const guid = word.id.slice(0, 10)

    // Resolve the Anki deck ID for this word's deck (leaf of the hierarchy)
    // Use case-insensitive lookup to match the deduped deck name
    const leafName = allDeckNames(deckName).at(-1)!
    const normalizedLeaf = seenLower.get(leafName.toLowerCase()) ?? leafName
    const wordDeckId = deckNameToAnkiId.get(normalizedLeaf) ?? firstLeafDeckId

    let csum = 0
    for (let j = 0; j < word.word.length; j++) {
      csum = ((csum << 5) - csum + word.word.charCodeAt(j)) | 0
    }
    csum = Math.abs(csum)

    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [
      noteId, guid, modelId, now, -1, '',
      `${front}\x1f${back}\x1f${word.id}`, word.word, csum, 0, '',
    ])

    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      noteId * 2, noteId, wordDeckId, 0, now, -1, 0, 0, noteId, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ])

    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      noteId * 2 + 1, noteId, wordDeckId, 1, now, -1, 0, 0, noteId, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ])
  }

  const dbData = db.export()
  db.close()

  const collectionData = new Uint8Array(dbData)
  const mediaData = new TextEncoder().encode('{}')

  return createZip([
    { name: 'collection.anki2', data: collectionData },
    { name: 'media', data: mediaData },
  ])
}

function createZip(files: Array<{ name: string; data: Uint8Array }>): Blob {
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
  for (const entry of cdParts) {
    parts.push(entry)
  }

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
