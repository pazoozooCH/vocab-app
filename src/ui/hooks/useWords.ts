import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { WordStatus } from '../../domain/values/WordStatus'
import type { Language } from '../../domain/values/Language'
import type { WordSortField, WordSortDirection } from '../../application/ports/WordRepository'
import { useAuth, useServices } from '../context/AppContext'
import { useCallback, useMemo } from 'react'

const PAGE_SIZE = 30

interface UseWordsOptions {
  deckId?: string
  language?: Language
  status?: WordStatus
  search?: string
  searchSentences?: boolean
  sortBy?: WordSortField
  sortDir?: WordSortDirection
}

export function useWords(options: UseWordsOptions = {}) {
  const { wordRepository } = useServices()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const queryKey = [
    'words',
    user?.id,
    options.deckId ?? 'all',
    options.language ?? 'all',
    options.status ?? 'all',
    options.search ?? '',
    options.searchSentences ?? false,
    options.sortBy ?? 'created_at',
    options.sortDir ?? 'desc',
  ]

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      wordRepository.findPaginated(user!.id, {
        deckId: options.deckId,
        language: options.language,
        status: options.status,
        search: options.search || undefined,
        searchSentences: options.searchSentences,
        sortBy: options.sortBy,
        sortDir: options.sortDir,
        offset: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined,
    enabled: !!user,
  })

  const words = useMemo(
    () => data?.pages.flatMap((p) => p.words) ?? [],
    [data],
  )

  const total = data?.pages[0]?.total ?? 0

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['words'] })
  }, [queryClient])

  return {
    words,
    total,
    loading,
    hasMore: hasNextPage ?? false,
    loadingMore: isFetchingNextPage,
    loadMore: fetchNextPage,
    reload,
  }
}
