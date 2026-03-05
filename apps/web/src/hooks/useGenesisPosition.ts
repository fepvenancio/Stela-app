'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useReadContract } from '@starknet-react/core'
import { RpcProvider, type Abi } from 'starknet'
import { toU256, findTokenByAddress } from '@fepvenancio/stela-sdk'
import genesisAbi from '@stela/core/abi/genesis.json'
import feeVaultAbi from '@stela/core/abi/fee-vault.json'
import { GENESIS_ADDRESS, FEE_VAULT_ADDRESS, RPC_URL } from '@/lib/config'
import { readU256 } from '@/lib/format'

/* ── Types ──────────────────────────────────────────────── */

export interface ClaimableToken {
  address: string
  symbol: string
  decimals: number
  amount: bigint
}

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
  /** Aggregated claimable amounts across all owned NFTs */
  claimable: ClaimableToken[]
  /** Whether any claimable amount > 0 */
  hasClaimable: boolean
  /** Loading states */
  isLoading: boolean
  isLoadingTokenIds: boolean
  isLoadingClaimable: boolean
  /** Refresh claimable amounts (e.g. after claiming) */
  refreshClaimable: () => void
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

/* ── Parallel claimable_all fetching ────────────────────── */

async function fetchClaimableAll(
  tokenIds: bigint[],
): Promise<ClaimableToken[]> {
  if (tokenIds.length === 0) return []

  // First get the fee tokens list
  let feeTokens: string[] = []
  try {
    const result = await PROVIDER.callContract({
      contractAddress: FEE_VAULT_ADDRESS,
      entrypoint: 'get_fee_tokens',
      calldata: [],
    })
    const data = result.map(BigInt)
    const len = Number(data[0])
    for (let i = 0; i < len; i++) {
      feeTokens.push('0x' + data[1 + i].toString(16))
    }
  } catch {
    return []
  }

  if (feeTokens.length === 0) return []

  // Fetch claimable_all for each token ID in parallel
  const perNftResults = await Promise.all(
    tokenIds.map(async (tokenId) => {
      try {
        const result = await PROVIDER.callContract({
          contractAddress: FEE_VAULT_ADDRESS,
          entrypoint: 'claimable_all',
          calldata: toU256(tokenId),
        })
        const data = result.map(BigInt)
        const tokensLen = Number(data[0])
        let offset = 1 + tokensLen // skip token addresses (we already have them)
        const amountsLen = Number(data[offset])
        offset++

        const amounts: bigint[] = []
        for (let i = 0; i < amountsLen; i++) {
          const low = data[offset]
          const high = data[offset + 1]
          amounts.push(low + (high << 128n))
          offset += 2
        }
        return amounts
      } catch {
        return feeTokens.map(() => 0n)
      }
    }),
  )

  // Aggregate across all NFTs
  const aggregated = new Map<string, bigint>()
  for (const amounts of perNftResults) {
    for (let i = 0; i < feeTokens.length && i < amounts.length; i++) {
      const prev = aggregated.get(feeTokens[i]) ?? 0n
      aggregated.set(feeTokens[i], prev + amounts[i])
    }
  }

  // Build result with token info
  const claimable: ClaimableToken[] = []
  for (const [addr, amount] of aggregated) {
    if (amount === 0n) continue
    const token = findTokenByAddress(addr)
    claimable.push({
      address: addr,
      symbol: token?.symbol ?? addr.slice(0, 10) + '...',
      decimals: token?.decimals ?? 18,
      amount,
    })
  }

  // Sort by amount descending (approximate — works for same-decimal tokens)
  claimable.sort((a, b) => (a.amount > b.amount ? -1 : 1))
  return claimable
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

  // Claimable amounts (parallel fetch, aggregated)
  const [claimable, setClaimable] = useState<ClaimableToken[]>([])
  const [isLoadingClaimable, setIsLoadingClaimable] = useState(false)
  const [claimVersion, setClaimVersion] = useState(0)

  const refreshClaimable = useCallback(() => {
    setClaimVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    if (tokenIds.length === 0) {
      setClaimable([])
      return
    }

    setIsLoadingClaimable(true)
    fetchClaimableAll(tokenIds)
      .then((result) => {
        setClaimable(result)
        setIsLoadingClaimable(false)
      })
      .catch(() => {
        setIsLoadingClaimable(false)
      })
  }, [tokenIds, claimVersion])

  const isLoading = balanceLoading || mintedLoading || isLoadingTokenIds || isLoadingClaimable

  return {
    balance,
    tokenIds,
    totalMinted,
    mintPrice,
    mintEnabled,
    claimable,
    hasClaimable: claimable.length > 0,
    isLoading,
    isLoadingTokenIds,
    isLoadingClaimable,
    refreshClaimable,
  }
}
