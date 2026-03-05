'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from '@starknet-react/core'
import { RpcProvider, type Abi } from 'starknet'
import { toU256 } from '@fepvenancio/stela-sdk'
import genesisAbi from '@stela/core/abi/genesis.json'
import { GENESIS_ADDRESS, RPC_URL } from '@/lib/config'
import { readU256 } from '@/lib/format'

/* ── Types ──────────────────────────────────────────────── */

export interface GenesisPosition {
  /** Number of Genesis NFTs the user owns */
  balance: bigint
  /** The specific token IDs owned */
  tokenIds: bigint[]
  /** Total minted so far */
  totalMinted: bigint
  /** Mint price in STRK (raw) */
  mintPrice: bigint
  /** Whether minting is enabled */
  mintEnabled: boolean
  /** Loading states */
  isLoading: boolean
  isLoadingTokenIds: boolean
}

const BATCH_SIZE = 25 // parallel RPC calls per batch
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL })

/* ── Parallel batched owner_of scanning ─────────────────── */

async function findOwnedTokenIds(
  owner: string,
  totalMinted: bigint,
  expectedBalance: bigint,
  signal: AbortSignal,
): Promise<bigint[]> {
  const owned: bigint[] = []
  const target = Number(expectedBalance)
  const total = Number(totalMinted)

  for (let batchStart = 1; batchStart <= total; batchStart += BATCH_SIZE) {
    if (signal.aborted || owned.length >= target) break

    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, total)
    const promises: Promise<{ id: bigint; isOwner: boolean }>[] = []

    for (let i = batchStart; i <= batchEnd; i++) {
      const tokenId = BigInt(i)
      promises.push(
        PROVIDER.callContract({
          contractAddress: GENESIS_ADDRESS,
          entrypoint: 'owner_of',
          calldata: toU256(tokenId),
        })
          .then((result) => {
            const tokenOwner = BigInt(result[0])
            return { id: tokenId, isOwner: tokenOwner === BigInt(owner) }
          })
          .catch(() => ({ id: tokenId, isOwner: false })),
      )
    }

    const results = await Promise.all(promises)
    for (const r of results) {
      if (r.isOwner) owned.push(r.id)
    }

    // Early termination: found all NFTs
    if (owned.length >= target) break
  }

  return owned.sort((a, b) => Number(a - b))
}

/* ── Main hook ──────────────────────────────────────────── */

export function useGenesisPosition(): GenesisPosition {
  const { address } = useAccount()

  // On-chain reads via starknet-react (cached, auto-refresh)
  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address] : [],
    watch: true,
  })

  const { data: totalMintedRaw, isLoading: mintedLoading } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'total_minted',
    args: [],
    watch: true,
  })

  const { data: mintPriceRaw } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'mint_price',
    args: [],
  })

  const { data: mintEnabledRaw } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'mint_enabled',
    args: [],
  })

  const balance = readU256(balanceRaw)
  const totalMinted = readU256(totalMintedRaw)
  const mintPrice = readU256(mintPriceRaw)
  const mintEnabled = mintEnabledRaw !== false && mintEnabledRaw !== 0n && mintEnabledRaw != null

  // Owned token IDs (batched parallel scan)
  const [tokenIds, setTokenIds] = useState<bigint[]>([])
  const [isLoadingTokenIds, setIsLoadingTokenIds] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!address || balance === 0n || totalMinted === 0n) {
      setTokenIds([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoadingTokenIds(true)
    findOwnedTokenIds(address, totalMinted, balance, controller.signal)
      .then((ids) => {
        if (!controller.signal.aborted) {
          setTokenIds(ids)
          setIsLoadingTokenIds(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsLoadingTokenIds(false)
        }
      })

    return () => controller.abort()
  }, [address, balance, totalMinted])

  const isLoading = balanceLoading || mintedLoading || isLoadingTokenIds

  return {
    balance,
    tokenIds,
    totalMinted,
    mintPrice,
    mintEnabled,
    isLoading,
    isLoadingTokenIds,
  }
}
