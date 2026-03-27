import type { SupabaseClient } from '@supabase/supabase-js'
import { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import type { DeckRepository } from '../../application/ports/DeckRepository'

interface DeckRow {
  id: string
  user_id: string
  name: string
  language: string
}

function toDomain(row: DeckRow): Deck {
  return Deck.create({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    language: row.language as Language,
  })
}

export class SupabaseDeckRepository implements DeckRepository {
  readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async save(deck: Deck): Promise<void> {
    const { data, error } = await this.client.from('decks').insert({
      id: deck.id,
      user_id: deck.userId,
      name: deck.name,
      language: deck.language,
    }).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Deck was not created (possibly blocked by RLS)')
  }

  async findById(id: string, userId: string): Promise<Deck | null> {
    const { data, error } = await this.client
      .from('decks')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return toDomain(data)
  }

  async findAllByUser(userId: string): Promise<Deck[]> {
    const { data, error } = await this.client
      .from('decks')
      .select()
      .eq('user_id', userId)
      .order('name', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async findByLanguage(language: Language, userId: string): Promise<Deck[]> {
    const { data, error } = await this.client
      .from('decks')
      .select()
      .eq('language', language)
      .eq('user_id', userId)
      .order('name', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async update(deck: Deck): Promise<void> {
    const { error } = await this.client
      .from('decks')
      .update({ name: deck.name })
      .eq('id', deck.id)
      .eq('user_id', deck.userId)
    if (error) throw error
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('decks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }
}
