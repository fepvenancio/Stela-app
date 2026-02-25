'use client'

import { useState, useEffect } from 'react'
import { MATCHING_ENGINE_URL } from '@/lib/config'

/**
 * useEngineHealth — polls the matching engine health endpoint once on mount.
 * Returns isOnline=false immediately if MATCHING_ENGINE_URL is falsy.
 */
export function useEngineHealth() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!MATCHING_ENGINE_URL) {
      setIsOnline(false)
      setIsChecking(false)
      return
    }

    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`${MATCHING_ENGINE_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!cancelled) setIsOnline(res.ok)
      } catch {
        if (!cancelled) setIsOnline(false)
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  return { isOnline, isChecking }
}
