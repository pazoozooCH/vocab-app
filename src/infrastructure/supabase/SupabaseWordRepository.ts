import type { SupabaseClient } from '@supabase/supabase-js'
import { Word } from '../../domain/entities/Word'
import type { Language } from '../../domain/values/Language'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import type { WordRepository, WordSearchParams, WordPage } from '../../application/ports/WordRepository'

interface WordRow {
  id: string
  user_id: string
  word: string
  language: string
  translations: string[]
  sentences_source: string[]
  sentences_german: string[]
  deck_id: string
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
    deckId: row.deck_id,
    status: row.status as WordStatus,
    createdAt: new Date(row.created_at),
    exportedAt: row.exported_at ? new Date(row.exported_at) : null,
  })
}

export class SupabaseWordRepository implements WordRepository {
  readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async save(word: Word): Promise<void> {
    const { data, error } = await this.client.from('words').insert({
      id: word.id,
      user_id: word.userId,
      word: word.word,
      language: word.language,
      translations: word.translations,
      sentences_source: word.sentencesSource,
      sentences_german: word.sentencesGerman,
      deck_id: word.deckId,
      status: word.status,
      created_at: word.createdAt.toISOString(),
      exported_at: word.exportedAt?.toISOString() ?? null,
    }).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Word was not saved (possibly blocked by RLS)')
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

  async findByDeckId(deckId: string, userId: string): Promise<Word[]> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(toDomain)
  }

  async findPendingByDeckId(deckId: string, userId: string): Promise<Word[]> {
    const { data, error } = await this.client
      .from('words')
      .select()
      .eq('deck_id', deckId)
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

  async findPaginated(userId: string, params: WordSearchParams): Promise<WordPage> {
    // For search that includes sentences, we need client-side filtering
    // because PostgREST can't easily search within text[] arrays
    if (params.search && params.searchSentences) {
      return this.findPaginatedWithFullSearch(userId, params)
    }

    let query = this.client
      .from('words')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (params.deckId) query = query.eq('deck_id', params.deckId)
    if (params.language) query = query.eq('language', params.language)
    if (params.status) query = query.eq('status', params.status)
    if (params.search) {
      // Search word and translations (word is text, translations checked via ilike)
      query = query.ilike('word', `%${params.search}%`)
    }

    const sortBy = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'

    // Map sort fields to actual DB columns
    // word/translation use generated lower() columns for case-insensitive sorting
    const orderColumn = sortBy === 'word' ? 'word_lower'
      : sortBy === 'translation' ? 'translation_lower'
      : 'created_at'
    const ascending = sortBy === 'created_at' ? sortDir === 'asc' : true

    const { data, error, count } = await query
      .order(orderColumn, { ascending })
      .range(params.offset, params.offset + params.limit - 1)

    if (error) throw error
    const words = (data ?? []).map(toDomain)
    const total = count ?? 0
    return { words, total, hasMore: params.offset + params.limit < total }
  }

  // Full-text search including sentences: fetch all matching words, filter client-side, paginate
  private async findPaginatedWithFullSearch(userId: string, params: WordSearchParams): Promise<WordPage> {
    let query = this.client
      .from('words')
      .select('*')
      .eq('user_id', userId)

    if (params.deckId) query = query.eq('deck_id', params.deckId)
    if (params.language) query = query.eq('language', params.language)
    if (params.status) query = query.eq('status', params.status)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    const term = (params.search ?? '').toLowerCase()
    const filtered = (data ?? []).map(toDomain).filter((w) =>
      w.word.toLowerCase().includes(term) ||
      w.translations.some((t) => t.toLowerCase().includes(term)) ||
      w.sentencesSource.some((s) => s.toLowerCase().includes(term)) ||
      w.sentencesGerman.some((s) => s.toLowerCase().includes(term))
    )

    const sortBy = params.sortBy ?? 'created_at'
    const sortDir = params.sortDir ?? 'desc'
    filtered.sort((a, b) => {
      if (sortBy === 'word') return a.word.localeCompare(b.word, undefined, { sensitivity: 'base' })
      if (sortBy === 'translation') return (a.translations[0] ?? '').localeCompare(b.translations[0] ?? '', undefined, { sensitivity: 'base' })
      const diff = a.createdAt.getTime() - b.createdAt.getTime()
      return sortDir === 'asc' ? diff : -diff
    })
    // Note: for sentence search, sorting is done client-side since we already fetched all data

    const total = filtered.length
    const words = filtered.slice(params.offset, params.offset + params.limit)
    return { words, total, hasMore: params.offset + params.limit < total }
  }

  async findDuplicates(word: string, language: Language, userId: string, excludeId?: string): Promise<Word[]> {
    const bareWord = word.replace(/\s*_\[.*?\]_$/, '').trim()
    let query = this.client
      .from('words')
      .select()
      .eq('user_id', userId)
      .eq('language', language)
      .ilike('word', bareWord)
    if (excludeId) {
      query = query.neq('id', excludeId)
    }
    const { data, error } = await query
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
        deck_id: word.deckId,
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
