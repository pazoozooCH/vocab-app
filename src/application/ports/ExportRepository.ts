import type { Export } from '../../domain/entities/Export'

export interface ExportRepository {
  save(exp: Export): Promise<void>
  findById(id: string, userId: string): Promise<Export | null>
  findAllByUser(userId: string): Promise<Export[]>
  update(exp: Export): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
