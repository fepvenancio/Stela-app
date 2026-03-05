'use client'

import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useGenesisPosition } from '@/hooks/useGenesisPosition'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_SUPPLY = 300

/* ── Discount Tiers ────────────────────────────────────── */

/** Base NFT discount only (volume tiers computed on-chain) */
function getBaseDiscountPercent(nftCount: number): number {
  if (nftCount <= 0) return 0
  // 15% base + 2% per additional NFT, capped at 50%
  return Math.min(15 + (nftCount - 1) * 2, 50)
}

function getDiscountTier(nftCount: number): string {
  if (nftCount >= 5) return 'Holder'
  if (nftCount >= 3) return 'Collector'
  if (nftCount >= 1) return 'Holder'
  return 'None'
}

/* ── Main Page ─────────────────────────────────────────── */

export default function GenesisClaimPage() {
  const { address } = useAccount()
  const pos = useGenesisPosition()

  const discount = getBaseDiscountPercent(Number(pos.balance))
  const tier = getDiscountTier(Number(pos.balance))

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
          Your NFTs
        </h1>
        <p className="text-dust text-sm leading-relaxed">
          View your Genesis NFTs and current fee discount tier.
        </p>
      </div>

      <Web3ActionWrapper message="Connect your wallet to view your Genesis position">
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
                <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">NFT Discount</span>
                <span className="text-xl font-display text-star">{discount}%+</span>
              </div>
              <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
                <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">Tier</span>
                <span className="text-xl font-display text-chalk">{tier}</span>
              </div>
            </div>

            {/* ── Discount Tiers ────────────────────────── */}
            <section className="bg-star/[0.03] border border-star/20 rounded-2xl overflow-hidden">
              <div className="px-6 py-5">
                <h2 className="font-display text-lg text-star uppercase tracking-[0.15em]">Discount Tiers</h2>
                <p className="text-[10px] text-ash mt-0.5">
                  15% base + 2% per extra NFT (shown below) + 5% per volume tier (on-chain). 50% cap.
                </p>
              </div>

              <div className="px-6 pb-5 space-y-2">
                {[
                  { nfts: 1, pct: 15, label: 'Base (1 NFT)' },
                  { nfts: 2, pct: 17, label: '+2% (2 NFTs)' },
                  { nfts: 3, pct: 19, label: '+4% (3 NFTs)' },
                  { nfts: 4, pct: 21, label: '+6% (4 NFTs)' },
                  { nfts: 5, pct: 23, label: '+8% (5 NFTs)' },
                ].map((t) => {
                  const isActive = Number(pos.balance) >= t.nfts
                  return (
                    <div
                      key={t.nfts}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isActive ? 'bg-star/5 border-star/20' : 'bg-abyss/30 border-edge/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-star/15 text-star' : 'bg-surface/40 text-ash'
                        }`}>
                          <span className="text-[10px] font-display">{t.nfts}</span>
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${isActive ? 'text-chalk' : 'text-dust'}`}>{t.label} Tier</span>
                          <span className="text-[10px] text-ash block">{t.nfts} NFT{t.nfts > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <span className={`text-base font-display ${isActive ? 'text-star' : 'text-ash'}`}>{t.pct}% off</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Your NFT IDs ──────────────────────────── */}
            {pos.tokenIds.length > 0 && (
              <section className="bg-surface/10 border border-edge/20 rounded-2xl overflow-hidden">
                <div className="px-6 py-3 border-b border-edge/15">
                  <h3 className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Your Token IDs</h3>
                </div>
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {pos.tokenIds.map((id) => (
                      <span key={id.toString()} className="text-[10px] font-mono text-chalk bg-surface/50 px-2 py-0.5 rounded-md border border-edge/20">
                        #{id.toString()}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {pos.isLoadingTokenIds && (
              <div className="flex justify-center py-4">
                <Skeleton className="h-6 w-32 bg-edge/20" />
              </div>
            )}

            {/* ── Info footer ──────────────────────────── */}
            <div className="flex items-center gap-3 px-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ash shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p className="text-[10px] text-ash leading-relaxed">
                Fee discounts are applied automatically when you settle or redeem inscriptions.
                The contract reads your NFT balance on-chain — no claiming needed.
              </p>
            </div>
          </div>
        )}
      </Web3ActionWrapper>
    </div>
  )
}
