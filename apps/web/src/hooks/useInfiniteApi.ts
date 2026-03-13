'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { buildApiUrl } from './api'

export interface UseInfiniteApiOptions {
  baseUrl: string
  params?: Record<string, string | number | undefined>
  limit?: number
  refreshInterval?: number
}

export interface UseInfiniteApiResult<T> {
  data: T[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => void
  refetch: () => void
}

interface ApiPageResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

/**
 * Paginated fetch hook that accumulates results across pages.
 * Resets to page 1 on refetch, stela:sync events, or refreshInterval.
 */
export function useInfiniteApi<T>(
  options: UseInfiniteApiOptions | null,
): UseInfiniteApiResult<T> {
  const { baseUrl, params, limit = 20, refreshInterval } = options ?? {}

  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(Boolean(options))
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track latest options to avoid stale closures
  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchPage = useCallback(async (targetPage: number, reset: boolean) => {
    const current = optionsRef.current
    if (!current) {
      setData([])
      setTotal(0)
      setIsLoading(false)
      setIsLoadingMore(false)
      setError(null)
      return
    }

    if (reset) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    try {
      const url = buildApiUrl(current.baseUrl, {
        ...current.params,
        page: targetPage,
        limit: current.limit ?? 20,
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ApiPageResponse<T>

      // Only update if options haven't changed during the fetch
      if (optionsRef.current !== current) return

      if (reset) {
        setData(json.data)
      } else {
        setData((prev) => [...prev, ...json.data])
      }
      setTotal(json.meta.total)
      setPage(targetPage)
    } catch (err) {
      if (optionsRef.current !== current) return
      setError(err instanceof Error ? err : new Error(String(err)))
      if (reset) {
        setData([])
        setTotal(0)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Refetch (reset to page 1)
  const refetch = useCallback(() => {
    setPage(1)
    fetchPage(1, true)
  }, [fetchPage])

  // Load next page
  const loadMore = useCallback(() => {
    if (isLoadingMore || isLoading) return
    const nextPage = page + 1
    fetchPage(nextPage, false)
  }, [page, isLoadingMore, isLoading, fetchPage])

  // Initial fetch + refetch when options change
  const serializedParams = options
    ? JSON.stringify({ baseUrl: options.baseUrl, params: options.params, limit: options.limit })
    : null

  useEffect(() => {
    if (!options) {
      setData([])
      setTotal(0)
      setPage(1)
      setIsLoading(false)
      setError(null)
      return
    }
    setPage(1)
    fetchPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedParams])

  // Listen for stela:sync → reset to page 1
  useEffect(() => {
    const onSync = () => { refetch() }
    window.addEventListener('stela:sync', onSync)
    return () => window.removeEventListener('stela:sync', onSync)
  }, [refetch])

  // Refresh interval → reset to page 1
  useEffect(() => {
    if (!refreshInterval || !options) return
    const id = setInterval(() => { refetch() }, refreshInterval)
    return () => clearInterval(id)
  }, [refreshInterval, options, refetch])

  const hasMore = data.length < total

  return {
    data,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
