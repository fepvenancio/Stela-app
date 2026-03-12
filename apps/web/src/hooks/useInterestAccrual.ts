'use client'

import { useState, useEffect, useMemo } from 'react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'

export interface AccruedAsset {
  address: string
  accrued: bigint
  total: bigint
  symbol: string
  decimals: number
}

export interface InterestAccrualResult {
  accruedAmounts: AccruedAsset[]
  elapsedSeconds: number
  progressPercent: number
  isComplete: boolean
}

/** BigInt ceiling division: divCeil(a, b) = (a + b - 1n) / b */
function divCeil(a: bigint, b: bigint): bigint {
  if (b === 0n) return a
  return (a + b - 1n) / b
}

interface InterestAsset {
  address: string
  value: string
}

/**
 * Computes real-time pro-rata interest accrual for an inscription.
 *
 * Formula (matching contract): ceil(interest * elapsed / duration)
 * For swaps (duration=0): always full interest.
 * Updates every 60 seconds.
 */
export function useInterestAccrual(
  interestAssets: InterestAsset[],
  signedAt: number,
  duration: number,
): InterestAccrualResult {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return useMemo(() => {
    if (signedAt <= 0 || interestAssets.length === 0) {
      return { accruedAmounts: [], elapsedSeconds: 0, progressPercent: 0, isComplete: false }
    }

    const rawElapsed = now - signedAt
    const elapsed = Math.max(0, Math.min(rawElapsed, duration > 0 ? duration : rawElapsed))
    const isComplete = duration > 0 ? rawElapsed >= duration : true

    const accruedAmounts: AccruedAsset[] = interestAssets.map((asset) => {
      const total = BigInt(asset.value || '0')
      const token = findTokenByAddress(asset.address)

      let accrued: bigint
      if (duration === 0) {
        // Swap: always full interest
        accrued = total
      } else {
        accrued = divCeil(total * BigInt(elapsed), BigInt(duration))
        // Clamp to total
        if (accrued > total) accrued = total
      }

      return {
        address: asset.address,
        accrued,
        total,
        symbol: token?.symbol ?? 'TOKEN',
        decimals: token?.decimals ?? 18,
      }
    })

    const progressPercent = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 100

    return {
      accruedAmounts,
      elapsedSeconds: elapsed,
      progressPercent,
      isComplete,
    }
  }, [interestAssets, signedAt, duration, now])
}
