import { useCallback, useEffect, useRef, useState } from 'react'
import type { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'

export function useDecks(language?: Language) {
  const { deckRepository } = useServices()
  const { user } = useAuth()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const lastFetchKey = useRef<string>('')
  const fetchInFlight = useRef(false)

  const reload = useCallback(async (force = false) => {
    if (!user) {
      setLoading(false)
      return
    }

    const key = `${user.id}:${language ?? 'all'}`
    if (!force && key === lastFetchKey.current) return
    if (fetchInFlight.current) return

    fetchInFlight.current = true
    setLoading(true)
    try {
      const result = language
        ? await deckRepository.findByLanguage(language, user.id)
        : await deckRepository.findAllByUser(user.id)
      lastFetchKey.current = key
      setDecks(result)
    } finally {
      setLoading(false)
      fetchInFlight.current = false
    }
  }, [deckRepository, user, language])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dep change
    reload()
  }, [reload])

  // Force reload (e.g. after creating/deleting a deck)
  const forceReload = useCallback(async () => {
    lastFetchKey.current = ''
    await reload(true)
  }, [reload])

  return { decks, loading, reload: forceReload }
}
