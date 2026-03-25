import { describe, it, expect } from 'vitest'
import { Deck } from './Deck'

describe('Deck', () => {
  const validProps = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'English::Basics',
    userId: 'u1b2c3d4-e5f6-7890-abcd-ef1234567890',
  }

  it('creates a deck with valid properties', () => {
    const deck = Deck.create(validProps)

    expect(deck.id).toBe(validProps.id)
    expect(deck.name).toBe('English::Basics')
    expect(deck.userId).toBe(validProps.userId)
  })

  it('rejects an empty name', () => {
    expect(() => Deck.create({ ...validProps, name: '' })).toThrow(
      'Deck name cannot be empty',
    )
  })

  it('rejects a name with only whitespace', () => {
    expect(() => Deck.create({ ...validProps, name: '   ' })).toThrow(
      'Deck name cannot be empty',
    )
  })

  it('trims whitespace from the name', () => {
    const deck = Deck.create({ ...validProps, name: '  French::Verbs  ' })
    expect(deck.name).toBe('French::Verbs')
  })

  it('renames a deck', () => {
    const deck = Deck.create(validProps)
    const renamed = deck.rename('English::Advanced')

    expect(renamed.name).toBe('English::Advanced')
    // original is unchanged
    expect(deck.name).toBe('English::Basics')
  })

  it('rejects renaming to an empty name', () => {
    const deck = Deck.create(validProps)
    expect(() => deck.rename('')).toThrow('Deck name cannot be empty')
  })
})
