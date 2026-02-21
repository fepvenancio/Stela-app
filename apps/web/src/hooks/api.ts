'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/** Centralized query keys to prevent typos and enable easy search */
export enum QueryKey {
  Inscriptions = 'inscriptions',
  InscriptionDetail = 'inscriptionDetail',
  InscriptionAssets = 'inscriptionAssets',
}

interface FetchState<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * Generic typed fetch hook for internal API routes.
 * Returns `{ data, isLoading, error, refetch }` consistently.
 *
 * @param url - API route URL (or null/undefined to skip fetching)
 * @param options - Optional fetch init options
 */
export function useFetchApi<T>(
  url: string | null | undefined,
  options?: RequestInit,
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: undefined,
    isLoading: Boolean(url),
    error: null,
  })

  // Track current URL to avoid setting stale state
  const urlRef = useRef(url)
  urlRef.current = url

  const fetchData = useCallback(async () => {
    if (!url) {
      setState({ data: undefined, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const res = await fetch(url, options)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as T
      // Only update if URL hasn't changed during the fetch
      if (urlRef.current === url) {
        setState({ data: json, isLoading: false, error: null })
      }
    } catch (err) {
      if (urlRef.current === url) {
        setState({ data: undefined, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) })
      }
    }
  }, [url, options])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { ...state, refetch: fetchData }
}

/**
 * Build a URL with query params, filtering out empty values.
 */
export function buildApiUrl(base: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `${base}?${qs}` : base
}
