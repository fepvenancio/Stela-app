'use client'

import { useCallback, useState } from 'react'
import type { MatchedOrder } from '@/hooks/useInstantSettle'

/** Asset record as stored in inscription_assets / order_data */
export interface MatchAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

/** On-chain inscription match returned by /api/inscriptions/match */
export interface OnChainMatch {
  id: string
  borrower: string
  duration: number
  deadline: number
  status?: string
  debtAssets?: MatchAsset[]
  collateralAssets?: MatchAsset[]
  interestAssets?: MatchAsset[]
}

export interface MatchResults {
  offchainMatches: MatchedOrder[]
  onchainMatches: OnChainMatch[]
  isChecking: boolean
  checkForMatches: (params: MatchDetectionParams) => Promise<void>
  hasMatches: boolean
  reset: () => void
}

export interface MatchDetectionParams {
  debtToken: string
  collateralToken: string
  duration: string | number
  /** For off-chain: exclude orders by this borrower. For on-chain: exclude inscriptions by this lender. */
  borrowerAddress: string
}

/**
 * useMatchDetection - queries for matches against both off-chain orders
 * AND on-chain inscriptions in parallel. Either endpoint failing does
 * not block results from the other.
 */
export function useMatchDetection(): MatchResults {
  const [offchainMatches, setOffchainMatches] = useState<MatchedOrder[]>([])
  const [onchainMatches, setOnchainMatches] = useState<OnChainMatch[]>([])
  const [isChecking, setIsChecking] = useState(false)

  const checkForMatches = useCallback(
    async (params: MatchDetectionParams) => {
      const { debtToken, collateralToken, duration, borrowerAddress } = params

      if (!debtToken || !collateralToken || !borrowerAddress) return

      setIsChecking(true)
      setOffchainMatches([])
      setOnchainMatches([])

      // Query both endpoints in parallel
      const offchainParams = new URLSearchParams({
        debtToken,
        collateralToken,
        duration: String(duration || '0'),
        borrower: borrowerAddress,
      })

      const onchainParams = new URLSearchParams({
        debtToken,
        collateralToken,
        duration: String(duration || '0'),
        lender: borrowerAddress,
      })

      const [offchainResult, onchainResult] = await Promise.allSettled([
        fetch(`/api/orders/match?${offchainParams}`).then(async (res) => {
          if (!res.ok) return []
          const { data } = (await res.json()) as { data: MatchedOrder[] }
          return data ?? []
        }),
        fetch(`/api/inscriptions/match?${onchainParams}`).then(async (res) => {
          if (!res.ok) return []
          const { data } = (await res.json()) as { data: OnChainMatch[] }
          return data ?? []
        }),
      ])

      const offchain =
        offchainResult.status === 'fulfilled' ? offchainResult.value : []
      const onchain =
        onchainResult.status === 'fulfilled' ? onchainResult.value : []

      setOffchainMatches(offchain)
      setOnchainMatches(onchain)
      setIsChecking(false)
    },
    [],
  )

  const hasMatches = offchainMatches.length > 0 || onchainMatches.length > 0

  const reset = useCallback(() => {
    setOffchainMatches([])
    setOnchainMatches([])
  }, [])

  return { offchainMatches, onchainMatches, isChecking, checkForMatches, hasMatches, reset }
}
