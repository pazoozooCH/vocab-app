import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'
import { useCallback } from 'react'

export function useDecks(language?: Language) {
  const { deckRepository } = useServices()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const queryKey = ['decks', user?.id, language ?? 'all']

  const { data: decks = [], isLoading: loading } = useQuery<Deck[]>({
    queryKey,
    queryFn: () =>
      language
        ? deckRepository.findByLanguage(language, user!.id)
        : deckRepository.findAllByUser(user!.id),
    enabled: !!user,
  })

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['decks'] })
  }, [queryClient])

  return { decks, loading, reload }
}
