'use client'

import { useAccount, useReadContract } from '@starknet-react/core'
import type { Abi } from 'starknet'
import genesisAbi from '@stela/core/abi/genesis.json'
import stelaAbi from '@stela/core/abi/stela.json'
import { GENESIS_ADDRESS, CONTRACT_ADDRESS } from '@/lib/config'
import { readU256 } from '@/lib/format'

/* ── Fee Constants (match contract) ────────────────────── */

const RELAYER_BPS = 5
const SETTLE_TREASURY_BASE = 20
const SWAP_TREASURY_BASE = 10

const SETTLE_TREASURY_FLOOR = 10
const SWAP_TREASURY_FLOOR = 5

const DISCOUNT_CAP = 50

/** Volume tier thresholds in raw 18-decimal amounts */
const VOLUME_TIERS: bigint[] = [
  10_000n * 10n ** 18n,
  25_000n * 10n ** 18n,
  50_000n * 10n ** 18n,
  100_000n * 10n ** 18n,
  250_000n * 10n ** 18n,
  500_000n * 10n ** 18n,
  1_000_000n * 10n ** 18n,
]

/* ── Helpers ───────────────────────────────────────────── */

function getVolumeTier(volume: bigint): number {
  let tier = 0
  for (const threshold of VOLUME_TIERS) {
    if (volume >= threshold) tier++
    else break
  }
  return tier
}

function calculateDiscount(nftBalance: bigint, volumeTier: number): number {
  if (nftBalance === 0n) return 0
  const base = 15
  const volumeBonus = 5 * volumeTier
  const nftBonus = 2 * Math.max(0, Number(nftBalance) - 1)
  return Math.min(DISCOUNT_CAP, base + volumeBonus + nftBonus)
}

/* ── Types ─────────────────────────────────────────────── */

export interface FeePreview {
  /** Base treasury BPS before discount */
  treasuryBps: number
  /** Relayer BPS (always 5, fixed) */
  relayerBps: number
  /** Base total BPS (treasury + relayer) */
  totalBaseBps: number
  /** User's Genesis NFT balance */
  nftBalance: bigint
  /** User's volume tier (0-7) */
  volumeTier: number
  /** Discount percentage applied to treasury (0-50) */
  discountPercent: number
  /** Effective treasury BPS after discount (floored) */
  effectiveTreasuryBps: number
  /** Effective total BPS (effective treasury + relayer) */
  effectiveTotalBps: number
  /** BPS saved vs base fee */
  savingsBps: number
  /** Whether on-chain data is still loading */
  isLoading: boolean
}

/* ── Hook ──────────────────────────────────────────────── */

export function useFeePreview(type: 'lending' | 'swap'): FeePreview {
  const { address } = useAccount()

  const treasuryBase = type === 'lending' ? SETTLE_TREASURY_BASE : SWAP_TREASURY_BASE
  const treasuryFloor = type === 'lending' ? SETTLE_TREASURY_FLOOR : SWAP_TREASURY_FLOOR
  const totalBaseBps = treasuryBase + RELAYER_BPS

  /* ── On-chain reads ──────────────────────────────────── */

  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address] : [],
    watch: true,
  })

  const { data: volumeRaw, isLoading: volumeLoading } = useReadContract({
    abi: stelaAbi as Abi,
    address: CONTRACT_ADDRESS,
    functionName: 'get_volume_settled',
    args: address ? [address] : [],
    watch: true,
  })

  const nftBalance = readU256(balanceRaw)
  const volume = readU256(volumeRaw)
  const volumeTier = getVolumeTier(volume)
  const discountPercent = calculateDiscount(nftBalance, volumeTier)

  /* ── Fee calculation ─────────────────────────────────── */

  const discountedTreasury = Math.round(treasuryBase * (1 - discountPercent / 100))
  const effectiveTreasuryBps = Math.max(treasuryFloor, discountedTreasury)
  const effectiveTotalBps = effectiveTreasuryBps + RELAYER_BPS
  const savingsBps = totalBaseBps - effectiveTotalBps

  return {
    treasuryBps: treasuryBase,
    relayerBps: RELAYER_BPS,
    totalBaseBps,
    nftBalance,
    volumeTier,
    discountPercent,
    effectiveTreasuryBps,
    effectiveTotalBps,
    savingsBps,
    isLoading: balanceLoading || volumeLoading,
  }
}
