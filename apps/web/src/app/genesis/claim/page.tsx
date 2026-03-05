'use client'

import Link from 'next/link'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@fepvenancio/stela-sdk'
import { FEE_VAULT_ADDRESS } from '@/lib/config'
import { useGenesisPosition, type ClaimableToken } from '@/hooks/useGenesisPosition'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTokenValue } from '@/lib/format'
import { getErrorMessage } from '@/lib/tx'

const MAX_SUPPLY = 500

const CLAIM_STEPS = [
  { label: 'Claim Fees', description: 'Claiming accumulated fees from vault' },
  { label: 'Confirming', description: 'Waiting for confirmation' },
]

/* ── Token Row ─────────────────────────────────────────── */

function TokenRow({ token }: { token: ClaimableToken }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        <TokenAvatarByAddress address={token.address} size={24} />
        <div>
          <span className="text-sm text-chalk font-medium block">{token.symbol}</span>
          <span className="text-[10px] text-ash font-mono">{token.address.slice(0, 10)}...{token.address.slice(-4)}</span>
        </div>
      </div>
      <span className="text-base font-mono text-star font-medium">
        {formatTokenValue(token.amount.toString(), token.decimals)}
      </span>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────── */

export default function GenesisClaimPage() {
  const { address } = useAccount()
  const pos = useGenesisPosition()
  const { sendAsync, isPending } = useSendTransaction({})
  const progress = useTransactionProgress(CLAIM_STEPS)

  async function handleClaimAll() {
    if (!address || pos.tokenIds.length === 0) return
    progress.start()
    try {
      const calldata: string[] = [String(pos.tokenIds.length)]
      for (const id of pos.tokenIds) {
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
      pos.refreshClaimable()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  async function handleClaimSingle(tokenId: bigint) {
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
      pos.refreshClaimable()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  const isClaimLoading = pos.isLoadingTokenIds || pos.isLoadingClaimable
  const sharePercent = pos.balance > 0n ? ((Number(pos.balance) / MAX_SUPPLY) * 100).toFixed(2) : '0'

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/genesis" className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Genesis
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-widest text-chalk mb-2 uppercase">
          Claim Fees
        </h1>
        <p className="text-dust text-sm leading-relaxed">
          View and claim accumulated protocol fees for your Genesis NFTs.
        </p>
      </div>

      <Web3ActionWrapper message="Connect your wallet to view claimable fees">
        {pos.balance === 0n && !pos.isLoading ? (
          /* No NFTs */
          <div className="bg-surface/15 border border-edge/25 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-star/5 border border-star/15 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-star/50">
                <path d="M12 2l8 4.5v7L12 22l-8-8.5v-7L12 2z" />
              </svg>
            </div>
            <p className="text-dust text-sm mb-4">You don&apos;t own any Genesis NFTs yet.</p>
            <Button asChild variant="gold" className="rounded-full px-8">
              <Link href="/genesis">Mint Genesis NFT</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Position Summary ──────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
                <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">NFTs Held</span>
                <span className="text-xl font-display text-chalk">{pos.balance.toString()}</span>
              </div>
              <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
                <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">Fee Share</span>
                <span className="text-xl font-display text-star">{sharePercent}%</span>
              </div>
              <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
                <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">Tokens</span>
                <span className="text-xl font-display text-chalk">
                  {isClaimLoading ? <Skeleton className="h-7 w-6 bg-edge/20 inline-block" /> : pos.claimable.length}
                </span>
              </div>
            </div>

            {/* ── Total Rewards Card (GMX pattern) ─────── */}
            <section className="bg-star/[0.03] border border-star/20 rounded-2xl overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg text-star uppercase tracking-[0.15em]">Total Claimable</h2>
                  <p className="text-[10px] text-ash mt-0.5">
                    Aggregated across {pos.tokenIds.length > 0 ? pos.tokenIds.length : '...'} NFT{pos.tokenIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="gold"
                  className="rounded-full px-8 shadow-[0_0_20px_rgba(232,168,37,0.15)]"
                  onClick={handleClaimAll}
                  disabled={!pos.hasClaimable || isPending || isClaimLoading}
                >
                  {isPending ? 'Claiming...' : 'Claim All'}
                </Button>
              </div>

              <div className="px-6 pb-5">
                {isClaimLoading ? (
                  <div className="space-y-3 pt-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-6 h-6 rounded-full bg-edge/20" />
                          <Skeleton className="h-4 w-20 bg-edge/20" />
                        </div>
                        <Skeleton className="h-4 w-24 bg-edge/20" />
                      </div>
                    ))}
                  </div>
                ) : pos.hasClaimable ? (
                  <div className="divide-y divide-star/10">
                    {pos.claimable.map((token) => (
                      <TokenRow key={token.address} token={token} />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-dust">No fees to claim yet</p>
                    <p className="text-[10px] text-ash mt-1 max-w-xs mx-auto leading-relaxed">
                      Fees accumulate as inscriptions are settled and redeemed. Check back after protocol activity.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Per-NFT Breakdown ────────────────────── */}
            {pos.tokenIds.length > 1 && pos.hasClaimable && (
              <section className="bg-surface/10 border border-edge/20 rounded-2xl overflow-hidden">
                <div className="px-6 py-3 border-b border-edge/15">
                  <h3 className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Per-NFT Actions</h3>
                </div>
                <div className="px-6 py-4 space-y-2">
                  {pos.tokenIds.map((id) => (
                    <div key={id.toString()} className="flex items-center justify-between p-3 bg-abyss/30 border border-edge/15 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-star/8 border border-star/15 flex items-center justify-center">
                          <span className="text-[10px] font-display text-star">#{id.toString()}</span>
                        </div>
                        <span className="text-sm text-chalk font-medium">Genesis #{id.toString()}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-3"
                        onClick={() => handleClaimSingle(id)}
                        disabled={isPending}
                      >
                        Claim
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Info footer ──────────────────────────── */}
            <div className="flex items-center gap-3 px-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p className="text-[10px] text-ash leading-relaxed">
                Fees accumulate indefinitely — no expiry, no penalty for late claiming.
                &quot;Claim All&quot; collects all fee tokens for all your NFTs in a single transaction.
              </p>
            </div>
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
