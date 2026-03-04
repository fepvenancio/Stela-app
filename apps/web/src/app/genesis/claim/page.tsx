'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAccount, useReadContract, useSendTransaction } from '@starknet-react/core'
import { RpcProvider, type Abi } from 'starknet'
import { toU256 } from '@fepvenancio/stela-sdk'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import genesisAbi from '@stela/core/abi/genesis.json'
import feeVaultAbi from '@stela/core/abi/fee-vault.json'
import { GENESIS_ADDRESS, FEE_VAULT_ADDRESS, RPC_URL } from '@/lib/config'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/tx'
import { formatTokenValue, readU256 } from '@/lib/format'

const CLAIM_STEPS = [
  { label: 'Claim Fees', description: 'Claiming accumulated fees from vault' },
  { label: 'Confirming', description: 'Waiting for confirmation' },
]

interface OwnedNft {
  tokenId: bigint
  claimable: { token: string; amount: bigint }[]
}

function useOwnedTokenIds(owner: string | undefined, totalMinted: bigint) {
  const [tokenIds, setTokenIds] = useState<bigint[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!owner || totalMinted === 0n) {
      setTokenIds([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    async function fetchOwned() {
      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      const owned: bigint[] = []

      // Sequential iteration to avoid overwhelming RPC
      for (let i = 1n; i <= totalMinted; i++) {
        if (cancelled) return
        try {
          const result = await provider.callContract({
            contractAddress: GENESIS_ADDRESS,
            entrypoint: 'owner_of',
            calldata: toU256(i),
          })
          // result is [felt252] — the owner address
          if (result && result.length > 0) {
            const tokenOwner = BigInt(result[0])
            if (tokenOwner === BigInt(owner!)) {
              owned.push(i)
            }
          }
        } catch {
          // Token might not exist yet or RPC error — skip
        }
      }

      if (!cancelled) {
        setTokenIds(owned)
        setIsLoading(false)
      }
    }

    fetchOwned()
    return () => { cancelled = true }
  }, [owner, totalMinted])

  return { tokenIds, isLoading }
}

function useClaimableAmounts(tokenIds: bigint[]) {
  const [nfts, setNfts] = useState<OwnedNft[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (tokenIds.length === 0) {
      setNfts([])
      return
    }

    setIsLoading(true)
    const provider = new RpcProvider({ nodeUrl: RPC_URL })
    const results: OwnedNft[] = []

    for (const tokenId of tokenIds) {
      try {
        const result = await provider.callContract({
          contractAddress: FEE_VAULT_ADDRESS,
          entrypoint: 'claimable_all',
          calldata: toU256(tokenId),
        })

        // Parse response: first element is tokens array length, then addresses,
        // then amounts array length, then u256 pairs
        const data = result.map(BigInt)
        const tokensLen = Number(data[0])
        const tokens: string[] = []
        let offset = 1

        for (let i = 0; i < tokensLen; i++) {
          tokens.push('0x' + data[offset].toString(16))
          offset++
        }

        const amountsLen = Number(data[offset])
        offset++
        const claimable: { token: string; amount: bigint }[] = []

        for (let i = 0; i < amountsLen; i++) {
          const low = data[offset]
          const high = data[offset + 1]
          const amount = low + (high << 128n)
          offset += 2
          if (amount > 0n) {
            claimable.push({ token: tokens[i], amount })
          }
        }

        results.push({ tokenId, claimable })
      } catch {
        results.push({ tokenId, claimable: [] })
      }
    }

    setNfts(results)
    setIsLoading(false)
  }, [tokenIds])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { nfts, isLoading, refresh }
}

function NftClaimCard({
  nft,
  onClaim,
  claiming,
}: {
  nft: OwnedNft
  onClaim: (tokenId: bigint) => void
  claiming: boolean
}) {
  const hasClaimable = nft.claimable.length > 0

  return (
    <Card className="p-5 bg-surface/20 border-edge/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-star/10 border border-star/20 flex items-center justify-center">
            <span className="text-sm font-display text-star">#{nft.tokenId.toString()}</span>
          </div>
          <div>
            <span className="text-sm font-display text-chalk block">Genesis #{nft.tokenId.toString()}</span>
            <span className="text-[10px] text-ash uppercase tracking-widest">
              {hasClaimable ? `${nft.claimable.length} token${nft.claimable.length > 1 ? 's' : ''} claimable` : 'No fees to claim'}
            </span>
          </div>
        </div>
        <Button
          variant="gold"
          size="sm"
          onClick={() => onClaim(nft.tokenId)}
          disabled={!hasClaimable || claiming}
        >
          {claiming ? 'Claiming...' : 'Claim'}
        </Button>
      </div>

      {hasClaimable && (
        <div className="space-y-2">
          {nft.claimable.map(({ token, amount }) => {
            const tokenInfo = findTokenByAddress(token)
            const symbol = tokenInfo?.symbol ?? token.slice(0, 10) + '...'
            const decimals = tokenInfo?.decimals ?? 18
            return (
              <div key={token} className="flex items-center justify-between p-3 bg-abyss/40 border border-edge/20 rounded-xl">
                <span className="text-xs text-dust">{symbol}</span>
                <span className="text-sm font-mono text-star">{formatTokenValue(amount.toString(), decimals)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function GenesisClaimPage() {
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const progress = useTransactionProgress(CLAIM_STEPS)

  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address] : [],
    watch: true,
  })

  const { data: totalMintedRaw } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'total_minted',
    args: [],
  })

  const balance = readU256(balanceRaw)
  const totalMinted = readU256(totalMintedRaw)

  const { tokenIds, isLoading: idsLoading } = useOwnedTokenIds(address, totalMinted)
  const { nfts, isLoading: claimLoading, refresh } = useClaimableAmounts(tokenIds)

  const totalClaimable = nfts.some(n => n.claimable.length > 0)
  const isLoading = balanceLoading || idsLoading || claimLoading

  async function handleClaim(tokenId: bigint) {
    if (!address) return

    progress.start()
    try {
      const result = await sendAsync([{
        contractAddress: FEE_VAULT_ADDRESS,
        entrypoint: 'claim',
        calldata: toU256(tokenId),
      }])
      progress.setTxHash(result.transaction_hash)
      progress.advance()
      progress.advance()
      refresh()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  async function handleClaimAll() {
    if (!address || tokenIds.length === 0) return

    progress.start()
    try {
      // Build calldata: [len, ...u256 pairs]
      const calldata: string[] = [String(tokenIds.length)]
      for (const id of tokenIds) {
        calldata.push(...toU256(id))
      }

      const result = await sendAsync([{
        contractAddress: FEE_VAULT_ADDRESS,
        entrypoint: 'claim_batch',
        calldata,
      }])
      progress.setTxHash(result.transaction_hash)
      progress.advance()
      progress.advance()
      refresh()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/genesis" className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Genesis
        </Link>
      </div>

      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-wide text-chalk mb-3">
          Claim Fees
        </h1>
        <p className="text-dust leading-relaxed">
          View and claim accumulated protocol fees for your Genesis NFTs.
        </p>
      </div>

      <Web3ActionWrapper message="Connect your wallet to view claimable fees">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full bg-edge/20 rounded-2xl" />
            <Skeleton className="h-32 w-full bg-edge/20 rounded-2xl" />
          </div>
        ) : balance === 0n ? (
          <Card className="p-8 bg-surface/20 border-edge/30 text-center">
            <p className="text-dust mb-4">You don&apos;t own any Genesis NFTs yet.</p>
            <Link href="/genesis">
              <Button variant="gold">Mint Genesis NFT</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Claim all header */}
            {tokenIds.length > 1 && totalClaimable && (
              <div className="flex items-center justify-between p-4 bg-star/[0.02] border border-star/20 rounded-2xl">
                <div>
                  <span className="text-sm font-display text-star block">Claim All</span>
                  <span className="text-[10px] text-ash">Claim fees for all {tokenIds.length} NFTs in one transaction</span>
                </div>
                <Button
                  variant="gold"
                  onClick={handleClaimAll}
                  disabled={isPending}
                >
                  {isPending ? 'Claiming...' : 'Claim All'}
                </Button>
              </div>
            )}

            {/* Per-NFT cards */}
            <div className="space-y-4">
              {nfts.map((nft) => (
                <NftClaimCard
                  key={nft.tokenId.toString()}
                  nft={nft}
                  onClaim={handleClaim}
                  claiming={isPending}
                />
              ))}
            </div>

            {!totalClaimable && nfts.length > 0 && (
              <div className="p-4 bg-surface/20 border border-edge/20 rounded-2xl text-center">
                <p className="text-sm text-dust">No fees to claim yet. Fees accumulate as inscriptions are settled and redeemed.</p>
              </div>
            )}
          </div>
        )}
      </Web3ActionWrapper>

      <TransactionProgressModal
        open={progress.open}
        steps={progress.steps}
        txHash={progress.txHash}
        onClose={progress.close}
      />
    </div>
  )
}
