import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Word } from '../../domain/entities/Word'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { useAuth, useServices } from '../context/AppContext'
import { useCallback } from 'react'

interface UseWordsOptions {
  deckId?: string
  status?: WordStatus
}

export function useWords(options: UseWordsOptions = {}) {
  const { wordRepository } = useServices()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const queryKey = ['words', user?.id, options.deckId ?? 'all', options.status ?? 'all']

  const { data: words = [], isLoading: loading } = useQuery<Word[]>({
    queryKey,
    queryFn: async () => {
      let result: Word[]
      if (options.deckId && options.status === WordStatusEnum.Pending) {
        result = await wordRepository.findPendingByDeckId(options.deckId, user!.id)
      } else if (options.deckId) {
        result = await wordRepository.findByDeckId(options.deckId, user!.id)
      } else {
        result = await wordRepository.findAllByUser(user!.id)
      }
      if (options.status && !(options.deckId && options.status === WordStatusEnum.Pending)) {
        result = result.filter((w) => w.status === options.status)
      }
      return result
    },
    enabled: !!user,
  })

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['words'] })
  }, [queryClient])

  return { words, loading, reload }
}
