import { describe, it, expect } from 'vitest'
import { Word } from './Word'
import { Language } from '../values/Language'
import { WordStatus } from '../values/WordStatus'

describe('Word', () => {
  const validProps = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    userId: 'u1b2c3d4-e5f6-7890-abcd-ef1234567890',
    word: 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: ['Hello, how are you?'],
    sentencesGerman: ['Hallo, wie geht es dir?'],
    deckId: 'deck-1',
    status: WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
  }

  it('creates a word with valid properties', () => {
    const word = Word.create(validProps)

    expect(word.id).toBe(validProps.id)
    expect(word.userId).toBe(validProps.userId)
    expect(word.word).toBe('hello')
    expect(word.language).toBe(Language.EN)
    expect(word.translations).toEqual(['hallo'])
    expect(word.sentencesSource).toEqual(['Hello, how are you?'])
    expect(word.sentencesGerman).toEqual(['Hallo, wie geht es dir?'])
    expect(word.deckId).toBe('deck-1')
    expect(word.status).toBe(WordStatus.Pending)
    expect(word.createdAt).toEqual(new Date('2026-03-25'))
    expect(word.exportedAt).toBeNull()
  })

  it('rejects an empty word', () => {
    expect(() => Word.create({ ...validProps, word: '' })).toThrow(
      'Word cannot be empty',
    )
  })

  it('rejects a word with only whitespace', () => {
    expect(() => Word.create({ ...validProps, word: '   ' })).toThrow(
      'Word cannot be empty',
    )
  })

  it('trims whitespace from the word', () => {
    const word = Word.create({ ...validProps, word: '  hello  ' })
    expect(word.word).toBe('hello')
  })

  it('rejects empty translations', () => {
    expect(() => Word.create({ ...validProps, translations: [] })).toThrow(
      'At least one translation is required',
    )
  })

  it('marks a word as exported', () => {
    const word = Word.create(validProps)
    const exported = word.markExported(new Date('2026-03-26'))

    expect(exported.status).toBe(WordStatus.Exported)
    expect(exported.exportedAt).toEqual(new Date('2026-03-26'))
    // original is unchanged
    expect(word.status).toBe(WordStatus.Pending)
  })
})
