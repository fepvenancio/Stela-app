'use client'

import { useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@fepvenancio/stela-sdk'
import { GENESIS_ADDRESS, STRK_ADDRESS } from '@/lib/config'
import { useGenesisPosition } from '@/hooks/useGenesisPosition'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/tx'

const MAX_SUPPLY = 300
const MAX_QUANTITY = 5
const STRK_DECIMALS = 18

function formatStrk(raw: bigint): string {
  const whole = raw / 10n ** BigInt(STRK_DECIMALS)
  return whole.toLocaleString()
}

/* ── Mint Section ──────────────────────────────────────── */

function MintSection({
  totalMinted,
  mintPrice,
  mintEnabled,
  soldOut,
}: {
  totalMinted: bigint
  mintPrice: bigint
  mintEnabled: boolean
  soldOut: boolean
}) {
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const [quantity, setQuantity] = useState(1)
  const progress = useTransactionProgress([
    { label: 'Approve STRK', description: 'Approve token spend for mint' },
    { label: 'Mint NFT', description: 'Mint Genesis NFT to your wallet' },
    { label: 'Confirming', description: 'Waiting for confirmation' },
  ])

  const totalCost = mintPrice * BigInt(quantity)
  const remaining = MAX_SUPPLY - Number(totalMinted)
  const mintPercentage = (Number(totalMinted) / MAX_SUPPLY) * 100
  const canMint = mintEnabled && !soldOut && !isPending && !!address

  async function handleMint() {
    if (!address || !canMint) return
    progress.start()
    try {
      await sendAsync([{
        contractAddress: STRK_ADDRESS,
        entrypoint: 'approve',
        calldata: [GENESIS_ADDRESS, ...toU256(totalCost)],
      }])
      progress.advance()
      const mintCalls = quantity === 1
        ? [{ contractAddress: GENESIS_ADDRESS, entrypoint: 'mint', calldata: [] as string[] }]
        : [{ contractAddress: GENESIS_ADDRESS, entrypoint: 'mint_batch', calldata: toU256(BigInt(quantity)) }]
      const result = await sendAsync(mintCalls)
      progress.setTxHash(result.transaction_hash)
      progress.advance()
      progress.advance()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  if (soldOut) {
    return (
      <section className="bg-surface/10 border border-edge/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Mint</h3>
          <span className="text-[10px] text-star font-bold uppercase tracking-widest">Sold Out</span>
        </div>
        <div className="h-1.5 bg-surface/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-star to-star-bright rounded-full w-full" />
        </div>
        <p className="text-[10px] text-ash mt-2 text-center">All {MAX_SUPPLY} Genesis NFTs have been minted.</p>
      </section>
    )
  }

  return (
    <>
      <section className="bg-star/[0.03] border border-star/20 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-star/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Mint Genesis NFT</h3>
            <span className="text-[10px] text-ash">{remaining} remaining</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-surface/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-star to-star-bright rounded-full transition-all duration-500"
              style={{ width: `${Math.min(mintPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-ash">{Number(totalMinted)} / {MAX_SUPPLY} minted</span>
            <span className="text-[9px] text-star font-medium">{formatStrk(mintPrice)} STRK each</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {!mintEnabled ? (
            <p className="text-sm text-nova text-center py-2">Minting is currently paused.</p>
          ) : (
            <>
              {/* Quantity + Cost */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="text-dust hover:text-chalk h-8 w-8"
                    aria-label="Decrease quantity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
                  </Button>
                  <span className="text-xl font-display text-chalk w-8 text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.min(MAX_QUANTITY, quantity + 1))}
                    disabled={quantity >= MAX_QUANTITY}
                    className="text-dust hover:text-chalk h-8 w-8"
                    aria-label="Increase quantity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                  </Button>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-ash uppercase tracking-widest block">Total</span>
                  <span className="text-lg font-display text-star">{formatStrk(totalCost)} STRK</span>
                </div>
              </div>

              <Button
                variant="gold"
                className="w-full"
                onClick={handleMint}
                disabled={!canMint}
              >
                {isPending ? 'Processing...' : `Mint ${quantity} NFT${quantity > 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </div>
      </section>

      <TransactionProgressModal
        open={progress.open}
        steps={progress.steps}
        txHash={progress.txHash}
        onClose={progress.close}
      />
    </>
  )
}

/* ── Fee Info Section ──────────────────────────────────── */

function FeeInfo() {
  return (
    <section className="bg-surface/10 border border-edge/20 rounded-2xl overflow-hidden">
      <div className="px-6 py-3 border-b border-edge/15">
        <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">NFT Fee Discounts</h3>
      </div>
      <div className="p-6">
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-abyss/40 border border-edge/15 rounded-xl">
            <span className="text-[9px] text-ash uppercase tracking-widest block mb-1">Base</span>
            <span className="text-base font-display text-star">15% off</span>
            <span className="text-[10px] text-ash block">Hold 1+ Genesis NFT</span>
          </div>
          <div className="p-3 bg-abyss/40 border border-edge/15 rounded-xl">
            <span className="text-[9px] text-ash uppercase tracking-widest block mb-1">Volume</span>
            <span className="text-base font-display text-star">+5% / tier</span>
            <span className="text-[10px] text-ash block">7 tiers ($10K to $1M+)</span>
          </div>
          <div className="p-3 bg-abyss/40 border border-edge/15 rounded-xl">
            <span className="text-[9px] text-ash uppercase tracking-widest block mb-1">Multi-NFT</span>
            <span className="text-base font-display text-star">+2% / NFT</span>
            <span className="text-[10px] text-ash block">Per additional NFT held</span>
          </div>
        </div>
        <p className="text-[11px] text-ash leading-relaxed">
          Genesis NFT holders receive protocol fee discounts up to 50%. Base 15% for holding any NFT,
          +5% per volume tier, +2% per additional NFT. Applies to treasury fees only (floors: settle 10 BPS, redeem 5 BPS).
          Ownership is renounced; supply is immutable.
        </p>
      </div>
    </section>
  )
}

/* ── Transparency Section ─────────────────────────────── */

function TransparencyInfo() {
  return (
    <section className="bg-surface/10 border border-edge/20 rounded-2xl overflow-hidden">
      <div className="px-6 py-3 border-b border-edge/15">
        <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Treasury & Transparency</h3>
      </div>
      <div className="p-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Treasury Reserve', value: '50 NFTs', desc: 'Protocol treasury. Funds audits, upgrades, licensing.' },
            { label: 'Public Supply', value: '250 NFTs', desc: 'Available for public mint at 1,000 STRK each.' },
            { label: 'Per-Wallet Cap', value: '5 Max', desc: 'Prevents concentration of discount power.' },
            { label: 'Ownership', value: 'Renounced', desc: 'Fully immutable. No admin can change supply or price.' },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-abyss/40 border border-edge/15 rounded-xl">
              <span className="text-[9px] text-ash uppercase tracking-widest block mb-1">{item.label}</span>
              <span className="text-base font-display text-star">{item.value}</span>
              <span className="text-[10px] text-ash block mt-0.5">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Main Page ─────────────────────────────────────────── */

export default function GenesisPage() {
  const pos = useGenesisPosition()
  const soldOut = pos.totalMinted >= BigInt(MAX_SUPPLY)
  const isHolder = pos.balance > 0n

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-widest text-chalk mb-2 uppercase">
          Genesis Collection
        </h1>
        <p className="text-dust text-sm leading-relaxed">
          {MAX_SUPPLY} Genesis NFTs — holders receive protocol fee discounts up to 50%.
        </p>
      </div>

      {/* Stats row — compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
          <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">Minted</span>
          {pos.isLoading ? (
            <Skeleton className="h-7 w-16 bg-edge/20" />
          ) : (
            <span className="text-xl font-display text-chalk">
              {pos.totalMinted.toString()}<span className="text-xs text-dust">/{MAX_SUPPLY}</span>
            </span>
          )}
        </div>
        <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
          <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">Price</span>
          <span className="text-xl font-display text-star">{formatStrk(pos.mintPrice)}<span className="text-xs text-dust"> STRK</span></span>
        </div>
        <div className="p-4 bg-surface/15 border border-edge/25 rounded-xl">
          <span className="text-[9px] text-ash uppercase tracking-widest block mb-1.5">You Hold</span>
          <span className="text-xl font-display text-chalk">{pos.balance.toString()}</span>
        </div>
      </div>

      <Web3ActionWrapper message="Connect your wallet to mint Genesis NFTs">
        <div className="space-y-5">
          {/* Your NFTs section — show discount tier if holder */}
          {isHolder && (
            <section className="bg-surface/15 border border-edge/25 rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-edge/20">
                <h2 className="font-display text-lg text-star uppercase tracking-[0.15em]">Your Position</h2>
                <p className="text-[10px] text-ash mt-0.5">
                  {Number(pos.balance)} NFT{Number(pos.balance) !== 1 ? 's' : ''} -- 15% base{Number(pos.balance) > 1 ? ` + ${(Number(pos.balance) - 1) * 2}% multi-NFT bonus` : ''} + volume tiers
                </p>
              </div>
              {pos.tokenIds.length > 0 && (
                <div className="px-6 py-3 bg-surface/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] text-ash uppercase tracking-widest">Your NFTs:</span>
                    {pos.tokenIds.map((id) => (
                      <span key={id.toString()} className="text-[10px] font-mono text-chalk bg-surface/50 px-2 py-0.5 rounded-md border border-edge/20">
                        #{id.toString()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Mint section */}
          <MintSection
            totalMinted={pos.totalMinted}
            mintPrice={pos.mintPrice}
            mintEnabled={pos.mintEnabled}
            soldOut={soldOut}
          />

          {/* Fee info */}
          <FeeInfo />

          {/* Transparency */}
          <TransparencyInfo />
        </div>
      </Web3ActionWrapper>
    </div>
  )
}
