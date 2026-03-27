import initSqlJs from 'sql.js'
import type { Word } from '../../domain/entities/Word'

// Convert markdown bold (**text**) to HTML <b>text</b>
function mdToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/_(\[.+?\])_/g, '<i>$1</i>')
}

function formatFront(word: Word): string {
  const lines = [
    `<div style="font-size:1.4em;font-weight:bold;">${mdToHtml(word.word)}</div>`,
    '<hr>',
    ...word.sentencesSource.map((s) => `<div>${mdToHtml(s)}</div>`),
  ]
  return lines.join('\n')
}

function formatBack(word: Word): string {
  const translationText = word.translations.map(mdToHtml).join(', ')
  const lines = [
    `<div style="font-size:1.4em;font-weight:bold;">${translationText}</div>`,
    '<hr>',
    ...word.sentencesGerman.map((s) => `<div>${mdToHtml(s)}</div>`),
  ]
  return lines.join('\n')
}

// Generate a deterministic numeric ID from a UUID string
function uuidToId(uuid: string): number {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    hash = ((hash << 5) - hash + uuid.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export async function generateApkg(words: Word[], deckName: string): Promise<Blob> {
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })
  const db = new SQL.Database()

  const modelId = 1607392319
  const deckId = uuidToId(deckName)
  const now = Math.floor(Date.now() / 1000)

  // Anki collection schema
  db.run(`
    CREATE TABLE col (
      id integer primary key,
      crt integer not null,
      mod integer not null,
      scm integer not null,
      ver integer not null,
      dty integer not null,
      usn integer not null,
      ls integer not null,
      conf text not null,
      models text not null,
      decks text not null,
      dconf text not null,
      tags text not null
    )
  `)

  db.run(`
    CREATE TABLE notes (
      id integer primary key,
      guid text not null,
      mid integer not null,
      mod integer not null,
      usn integer not null,
      tags text not null,
      flds text not null,
      sfld text not null,
      csum integer not null,
      flags integer not null,
      data text not null
    )
  `)

  db.run(`
    CREATE TABLE cards (
      id integer primary key,
      nid integer not null,
      did integer not null,
      ord integer not null,
      mod integer not null,
      usn integer not null,
      type integer not null,
      queue integer not null,
      due integer not null,
      ivl integer not null,
      factor integer not null,
      reps integer not null,
      lapses integer not null,
      left integer not null,
      odue integer not null,
      odid integer not null,
      flags integer not null,
      data text not null
    )
  `)

  db.run(`
    CREATE TABLE revlog (
      id integer primary key,
      cid integer not null,
      usn integer not null,
      ease integer not null,
      ivl integer not null,
      lastIvl integer not null,
      factor integer not null,
      time integer not null,
      type integer not null
    )
  `)

  db.run('CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null)')

  // Basic (and reversed card) model
  const models = JSON.stringify({
    [modelId]: {
      id: modelId,
      name: 'Basic (and reversed card)',
      type: 0,
      mod: now,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: [
        { name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id=answer>{{Back}}', ord: 0 },
        { name: 'Card 2', qfmt: '{{Back}}', afmt: '{{FrontSide}}<hr id=answer>{{Front}}', ord: 1 },
      ],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      ],
      css: '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
      latexPre: '',
      latexPost: '',
      latexsvg: false,
      req: [[0, 'any', [0]], [1, 'any', [1]]],
      vers: [],
      tags: [],
    },
  })

  const decks = JSON.stringify({
    1: { id: 1, name: 'Default', mod: now, usn: -1, collapsed: true, desc: '', dyn: 0, conf: 1 },
    [deckId]: { id: deckId, name: deckName, mod: now, usn: -1, collapsed: false, desc: '', dyn: 0, conf: 1 },
  })

  const conf = JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [1], curDeck: deckId, newSpread: 0, collapseTime: 1200, timeLim: 0, addToCur: true, curModel: modelId, dueCounts: true, sortType: 'noteFld', sortBackwards: false })
  const dconf = JSON.stringify({ 1: { id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20 }, rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 }, lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 } } })

  db.run('INSERT INTO col VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [1, now, now, now * 1000, 11, 0, 0, 0, conf, models, decks, dconf, '{}'])

  // Add notes and cards
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const noteId = now * 1000 + i
    const front = formatFront(word)
    const back = formatBack(word)
    const guid = word.id.slice(0, 10)

    // Simple checksum of the sort field
    let csum = 0
    for (let j = 0; j < word.word.length; j++) {
      csum = ((csum << 5) - csum + word.word.charCodeAt(j)) | 0
    }
    csum = Math.abs(csum)

    db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      [noteId, guid, modelId, now, -1, '', `${front}\x1f${back}`, word.word, csum, 0, ''])

    // Card 1: Front → Back
    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [noteId * 2, noteId, deckId, 0, now, -1, 0, 0, noteId, 0, 0, 0, 0, 0, 0, 0, 0, ''])

    // Card 2: Back → Front (reversed)
    db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [noteId * 2 + 1, noteId, deckId, 1, now, -1, 0, 0, noteId, 0, 0, 0, 0, 0, 0, 0, 0, ''])
  }

  const dbData = db.export()
  db.close()

  // Create ZIP file (apkg format)
  // Minimal ZIP implementation for two files: collection.anki2 + media
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

    // Local file header
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

    // Central directory entry
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

  // End of central directory
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
