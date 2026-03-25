import { useCallback, useEffect, useState } from 'react'
import type { Deck } from '../../domain/entities/Deck'
import { useAuth, useServices } from '../context/AppContext'

export function useDecks() {
  const { deckRepository } = useServices()
  const { user } = useAuth()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const result = await deckRepository.findAllByUser(user.id)
    setDecks(result)
    setLoading(false)
  }, [deckRepository, user])

  useEffect(() => {
    reload()
  }, [reload])

  return { decks, loading, reload }
}
