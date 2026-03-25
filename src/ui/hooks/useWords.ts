import { useCallback, useEffect, useState } from 'react'
import type { Word } from '../../domain/entities/Word'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { useAuth, useServices } from '../context/AppContext'

interface UseWordsOptions {
  deck?: string
  status?: WordStatus
}

export function useWords(options: UseWordsOptions = {}) {
  const { wordRepository } = useServices()
  const { user } = useAuth()
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let result: Word[]
    if (options.deck && options.status === WordStatusEnum.Pending) {
      result = await wordRepository.findPendingByDeck(options.deck, user.id)
    } else if (options.deck) {
      result = await wordRepository.findByDeck(options.deck, user.id)
    } else {
      result = await wordRepository.findAllByUser(user.id)
    }
    if (options.status && !(options.deck && options.status === WordStatusEnum.Pending)) {
      result = result.filter((w) => w.status === options.status)
    }
    setWords(result)
    setLoading(false)
  }, [wordRepository, user, options.deck, options.status])

  useEffect(() => {
    reload()
  }, [reload])

  return { words, loading, reload }
}
