'use client'

import { useMemo } from 'react'
import {
  computePositionValue,
  computeSafePositionFloor,
} from '@fepvenancio/stela-sdk'
import type { Asset, PositionValue, AssetValue } from '@fepvenancio/stela-sdk'

interface UsePositionValueParams {
  inscriptionId: string
  shares: bigint
  totalSupply: bigint
  debtAssets: Asset[]
  interestAssets: Asset[]
  collateralAssets: Asset[]
  signedAt: bigint
  duration: bigint
  nowSeconds?: bigint
}

interface PositionValueResult {
  value: PositionValue | null
  safeFloor: { debtFloor: AssetValue[]; interestFloor: AssetValue[] } | null
}

/**
 * Compute position value and safe floor price for a lending position.
 * Updates reactively based on input params.
 */
export function usePositionValue(params: UsePositionValueParams | null): PositionValueResult {
  return useMemo(() => {
    if (!params || params.totalSupply === 0n || params.shares === 0n) {
      return { value: null, safeFloor: null }
    }

    const now = params.nowSeconds ?? BigInt(Math.floor(Date.now() / 1000))
    const elapsed = now > params.signedAt ? now - params.signedAt : 0n

    const value = computePositionValue({
      inscriptionId: params.inscriptionId,
      shares: params.shares,
      totalSupply: params.totalSupply,
      debtAssets: params.debtAssets,
      interestAssets: params.interestAssets,
      collateralAssets: params.collateralAssets,
      elapsed,
      duration: params.duration,
    })

    const safeFloor = computeSafePositionFloor({
      shares: params.shares,
      totalSupply: params.totalSupply,
      debtAssets: params.debtAssets,
      interestAssets: params.interestAssets,
      elapsed,
      duration: params.duration,
    })

    return { value, safeFloor }
  }, [
    params?.inscriptionId,
    params?.shares,
    params?.totalSupply,
    params?.debtAssets,
    params?.interestAssets,
    params?.collateralAssets,
    params?.signedAt,
    params?.duration,
    params?.nowSeconds,
  ])
}
