import type { SupabaseClient } from '@supabase/supabase-js'
import { Word } from '../../domain/entities/Word'
import type { Language } from '../../domain/values/Language'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import type { WordRepository } from '../../application/ports/WordRepository'

interface WordRow {
  id: string
  user_id: string
  word: string
  language: string
  translations: string[]
  sentences_source: string[]
  sentences_german: string[]
  deck: string
  status: string
  created_at: string
  exported_at: string | null
}

function toDomain(row: WordRow): Word {
  return Word.create({
    id: row.id,
    userId: row.user_id,
    word: row.word,
    language: row.language as Language,
    translations: row.translations,
    sentencesSource: row.sentences_source,
    sentencesGerman: row.sentences_german,
    deck: row.deck,
    status: row.status as WordStatus,
    createdAt: new Date(row.created_at),
    exportedAt: row.exported_at ? new Date(row.exported_at) : null,
  })
}

export class SupabaseWordRepository implements WordRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(word: Word): Promise<void> {
    const { error } = await this.client.from('words').insert({
      id: word.id,
      user_id: word.userId,
      word: word.word,
      language: word.language,
      translations: word.translations,
      sentences_source: word.sentencesSource,
      sentences_german: word.sentencesGerman,
      deck: word.deck,
      status: word.status,
      created_at: word.createdAt.toISOString(),
      exported_at: word.exportedAt?.toISOString() ?? null,
    })
    if (error) throw error
  }

  async findById(id: string, userId: string): Promise<Word | null> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return toDomain(data)
  }

  async findByDeck(deck: string, userId: string): Promise<Word[]> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('deck', deck)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async findPendingByDeck(deck: string, userId: string): Promise<Word[]> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('deck', deck)
      .eq('user_id', userId)
      .eq('status', WordStatusEnum.Pending)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async findAllByUser(userId: string): Promise<Word[]> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async update(word: Word): Promise<void> {
    const { error } = await this.client
      .from('words')
      .update({
        word: word.word,
        language: word.language,
        translations: word.translations,
        sentences_source: word.sentencesSource,
        sentences_german: word.sentencesGerman,
        deck: word.deck,
        status: word.status,
        exported_at: word.exportedAt?.toISOString() ?? null,
      })
      .eq('id', word.id)
      .eq('user_id', word.userId)
    if (error) throw error
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('words')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }
}
