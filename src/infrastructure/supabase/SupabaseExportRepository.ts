import type { SupabaseClient } from '@supabase/supabase-js'
import { Export } from '../../domain/entities/Export'
import type { ExportStatus } from '../../domain/values/ExportStatus'
import type { ExportRepository } from '../../application/ports/ExportRepository'

interface ExportRow {
  id: string
  user_id: string
  status: string
  word_ids: string[]
  deck_filter: string
  word_count: number
  created_at: string
}

function toDomain(row: ExportRow): Export {
  return Export.create({
    id: row.id,
    userId: row.user_id,
    status: row.status as ExportStatus,
    wordIds: row.word_ids,
    deckFilter: row.deck_filter,
    wordCount: row.word_count,
    createdAt: new Date(row.created_at),
  })
}

export class SupabaseExportRepository implements ExportRepository {
  readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async save(exp: Export): Promise<void> {
    const { error } = await this.client.from('exports').insert({
      id: exp.id,
      user_id: exp.userId,
      status: exp.status,
      word_ids: exp.wordIds,
      deck_filter: exp.deckFilter,
      word_count: exp.wordCount,
      created_at: exp.createdAt.toISOString(),
    })
    if (error) throw error
  }

  async findById(id: string, userId: string): Promise<Export | null> {
    const { data, error } = await this.client
      .from('exports')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return toDomain(data)
  }

  async findAllByUser(userId: string): Promise<Export[]> {
    const { data, error } = await this.client
      .from('exports')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(toDomain)
  }

  async update(exp: Export): Promise<void> {
    const { error } = await this.client
      .from('exports')
      .update({ status: exp.status })
      .eq('id', exp.id)
      .eq('user_id', exp.userId)
    if (error) throw error
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('exports')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }
}
