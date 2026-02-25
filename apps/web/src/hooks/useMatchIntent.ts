'use client'

import { useState, useCallback, useMemo } from 'react'
import { MatchingClient } from '@fepvenancio/stela-sdk'
import type { TakerIntent, MatchResponse } from '@fepvenancio/stela-sdk'
import { MATCHING_ENGINE_URL } from '@/lib/config'

/**
 * useMatchIntent — wraps MatchingClient.matchIntent() and exposes
 * loading, error, and engineOffline states.
 */
export function useMatchIntent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [engineOffline, setEngineOffline] = useState(false)

  const client = useMemo(
    () => new MatchingClient({ baseUrl: MATCHING_ENGINE_URL }),
    [],
  )

  const matchIntent = useCallback(
    async (intent: TakerIntent): Promise<MatchResponse | null> => {
      setIsLoading(true)
      setError(null)
      setEngineOffline(false)

      try {
        const result = await client.matchIntent(intent)
        return result
      } catch (err: unknown) {
        if (err instanceof TypeError && err.message.includes('fetch')) {
          setEngineOffline(true)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [client],
  )

  return { matchIntent, isLoading, error, engineOffline }
}
