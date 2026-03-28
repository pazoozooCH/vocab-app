import { useCallback, useEffect, useRef, useState } from 'react'
import type { Word } from '../../domain/entities/Word'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { useAuth, useServices } from '../context/AppContext'

interface UseWordsOptions {
  deckId?: string
  status?: WordStatus
}

export function useWords(options: UseWordsOptions = {}) {
  const { wordRepository } = useServices()
  const { user } = useAuth()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const lastFetchKey = useRef<string>('')
  const fetchInFlight = useRef(false)

  const reload = useCallback(async (force = false) => {
    if (!user) {
      setLoading(false)
      return
    }

    const key = `${user.id}:${options.deckId ?? 'all'}:${options.status ?? 'all'}`
    if (!force && key === lastFetchKey.current) return
    if (fetchInFlight.current) return

    fetchInFlight.current = true
    setLoading(true)
    try {
      let result: Word[]
      if (options.deckId && options.status === WordStatusEnum.Pending) {
        result = await wordRepository.findPendingByDeckId(options.deckId, user.id)
      } else if (options.deckId) {
        result = await wordRepository.findByDeckId(options.deckId, user.id)
      } else {
        result = await wordRepository.findAllByUser(user.id)
      }
      if (options.status && !(options.deckId && options.status === WordStatusEnum.Pending)) {
        result = result.filter((w) => w.status === options.status)
      }
      lastFetchKey.current = key
      setWords(result)
    } finally {
      setLoading(false)
      fetchInFlight.current = false
    }
  }, [wordRepository, user, options.deckId, options.status])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dep change
    reload()
  }, [reload])

  // Force reload (e.g. after deleting a word)
  const forceReload = useCallback(async () => {
    lastFetchKey.current = ''
    await reload(true)
  }, [reload])

  return { words, loading, reload: forceReload }
}
