import { useCallback, useEffect, useState } from 'react'
import type { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'

export function useDecks(language?: Language) {
  const { deckRepository } = useServices()
  const { user } = useAuth()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const result = language
      ? await deckRepository.findByLanguage(language, user.id)
      : await deckRepository.findAllByUser(user.id)
    setDecks(result)
    setLoading(false)
  }, [deckRepository, user, language])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dep change
    reload()
  }, [reload])

  return { decks, loading, reload }
}
