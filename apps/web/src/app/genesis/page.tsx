'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAccount, useReadContract, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@fepvenancio/stela-sdk'
import type { Abi } from 'starknet'
import genesisAbi from '@stela/core/abi/genesis.json'
import { GENESIS_ADDRESS, STRK_ADDRESS } from '@/lib/config'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { TransactionProgressModal } from '@/components/TransactionProgressModal'
import { useTransactionProgress } from '@/hooks/useTransactionProgress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/tx'
import { readU256 } from '@/lib/format'

const MINT_STEPS = [
  { label: 'Approve STRK', description: 'Approve token spend for mint' },
  { label: 'Mint NFT', description: 'Mint Genesis NFT to your wallet' },
  { label: 'Confirming', description: 'Waiting for confirmation' },
]

const MAX_SUPPLY = 500
const MAX_QUANTITY = 5
const STRK_DECIMALS = 18

function formatStrk(raw: bigint): string {
  const whole = raw / 10n ** BigInt(STRK_DECIMALS)
  return whole.toLocaleString()
}

export default function GenesisPage() {
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const [quantity, setQuantity] = useState(1)
  const progress = useTransactionProgress(MINT_STEPS)

  const { data: totalMintedRaw, isLoading: mintedLoading } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'total_minted',
    args: [],
    watch: true,
  })

  const { data: mintPriceRaw, isLoading: priceLoading } = useReadContract({
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

  const { data: balanceRaw } = useReadContract({
    abi: genesisAbi as Abi,
    address: GENESIS_ADDRESS,
    functionName: 'balance_of',
    args: address ? [address] : [],
    watch: true,
  })

  const totalMinted = readU256(totalMintedRaw)
  const mintPrice = readU256(mintPriceRaw)
  const mintEnabled = mintEnabledRaw !== false && mintEnabledRaw !== 0n && mintEnabledRaw != null
  const balance = readU256(balanceRaw)
  const totalCost = mintPrice * BigInt(quantity)
  const soldOut = totalMinted >= BigInt(MAX_SUPPLY)
  const mintPercentage = (Number(totalMinted) / MAX_SUPPLY) * 100
  const remaining = MAX_SUPPLY - Number(totalMinted)

  const canMint = useMemo(() => {
    return mintEnabled && !soldOut && !isPending && !!address
  }, [mintEnabled, soldOut, isPending, address])

  async function handleMint() {
    if (!address || !canMint) return

    progress.start()

    try {
      // Step 1: Approve STRK spend
      const approveCalls = [{
        contractAddress: STRK_ADDRESS,
        entrypoint: 'approve',
        calldata: [GENESIS_ADDRESS, ...toU256(totalCost)],
      }]

      await sendAsync(approveCalls)
      progress.advance()

      // Step 2: Mint
      const mintCalls = quantity === 1
        ? [{ contractAddress: GENESIS_ADDRESS, entrypoint: 'mint', calldata: [] as string[] }]
        : [{ contractAddress: GENESIS_ADDRESS, entrypoint: 'mint_batch', calldata: toU256(BigInt(quantity)) }]

      const result = await sendAsync(mintCalls)
      progress.setTxHash(result.transaction_hash)
      progress.advance()

      // Step 3: Done
      progress.advance()
    } catch (err: unknown) {
      progress.fail(getErrorMessage(err))
    }
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-wide text-chalk mb-3">
          Genesis Collection
        </h1>
        <p className="text-dust leading-relaxed">
          {MAX_SUPPLY} Genesis NFTs — 100 reserved for the protocol treasury, 400 available for public mint.
          Each earns a perpetual share of all protocol fees.
          Settle fees (20 BPS) and redeem fees (10 BPS) are split across all {MAX_SUPPLY} holders.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-5 bg-surface/20 border-edge/30">
          <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Minted</span>
          {mintedLoading ? (
            <Skeleton className="h-8 w-20 bg-edge/20" />
          ) : (
            <span className="text-2xl font-display text-chalk">
              {totalMinted.toString()} <span className="text-sm text-dust">/ {MAX_SUPPLY}</span>
            </span>
          )}
        </Card>
        <Card className="p-5 bg-surface/20 border-edge/30">
          <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Price</span>
          {priceLoading ? (
            <Skeleton className="h-8 w-20 bg-edge/20" />
          ) : (
            <span className="text-2xl font-display text-star">{formatStrk(mintPrice)} <span className="text-sm text-dust">STRK</span></span>
          )}
        </Card>
        <Card className="p-5 bg-surface/20 border-edge/30">
          <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Your NFTs</span>
          <span className="text-2xl font-display text-chalk">{address ? balance.toString() : '--'}</span>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="h-2 bg-surface/30 rounded-full overflow-hidden border border-edge/20">
          <div
            className="h-full bg-gradient-to-r from-star to-star-bright rounded-full transition-all duration-500"
            style={{ width: `${Math.min(mintPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-ash">{mintPercentage.toFixed(1)}% minted</span>
          <span className="text-[10px] text-ash">{remaining} remaining</span>
        </div>
      </div>

      <Web3ActionWrapper message="Connect your wallet to mint Genesis NFTs">
        {/* Mint card */}
        <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden mb-8">
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="font-display text-lg text-star uppercase tracking-widest">Mint</h3>
              {!mintEnabled && !soldOut && (
                <p className="text-sm text-nova">Minting is currently paused.</p>
              )}
              {soldOut && (
                <p className="text-sm text-nova">Sold out! All {MAX_SUPPLY} Genesis NFTs have been minted.</p>
              )}
            </div>

            {!soldOut && (
              <>
                <div className="space-y-3">
                  <label className="text-[10px] text-ash uppercase tracking-widest font-bold block">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="text-dust hover:text-chalk"
                      aria-label="Decrease quantity"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                      </svg>
                    </Button>
                    <span className="text-2xl font-display text-chalk w-12 text-center">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.min(MAX_QUANTITY, quantity + 1))}
                      disabled={quantity >= MAX_QUANTITY}
                      className="text-dust hover:text-chalk"
                      aria-label="Increase quantity"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
                  <span className="text-sm text-dust">Total Cost</span>
                  <span className="text-lg font-display text-star">{formatStrk(totalCost)} STRK</span>
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

            {balance > 0n && (
              <Link
                href="/genesis/claim"
                className="flex items-center justify-center gap-2 text-sm text-star hover:text-star-bright transition-colors"
              >
                Claim Fees
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </Card>
      </Web3ActionWrapper>

      {/* Info section */}
      <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
          <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Fee Distribution</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Settle Fee</span>
              <span className="text-lg font-display text-star">20 BPS</span>
              <span className="text-xs text-dust block mt-1">0.20% of each settled inscription</span>
            </div>
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Redeem Fee</span>
              <span className="text-lg font-display text-star">10 BPS</span>
              <span className="text-xs text-dust block mt-1">0.10% of each share redemption</span>
            </div>
          </div>
          <p className="text-xs text-dust leading-relaxed">
            Fees accumulate in the vault and are split equally across all {MAX_SUPPLY} Genesis NFTs.
            Claim anytime — there is no expiry on accumulated fees.
          </p>
        </div>
      </section>

      {/* Treasury & Transparency */}
      <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
          <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Treasury &amp; Transparency</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Treasury Reserve</span>
              <span className="text-lg font-display text-star">100 NFTs</span>
              <span className="text-xs text-dust block mt-1">Minted to the protocol treasury at deployment. Funds audits, upgrades, and licensing. Hardcoded in the contract constructor.</span>
            </div>
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Public Supply</span>
              <span className="text-lg font-display text-star">400 NFTs</span>
              <span className="text-xs text-dust block mt-1">Available for public minting at 5,000 STRK each after the treasury reserve.</span>
            </div>
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Per-Wallet Cap</span>
              <span className="text-lg font-display text-star">5 Max</span>
              <span className="text-xs text-dust block mt-1">Public minting is capped at 5 NFTs per wallet to prevent concentration.</span>
            </div>
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Ownership</span>
              <span className="text-lg font-display text-star">Renounced</span>
              <span className="text-xs text-dust block mt-1">After deployment, contract ownership is permanently renounced. No admin can mint more NFTs, change the price, or pause minting. Fully immutable.</span>
            </div>
          </div>
        </div>
      </section>

      <TransactionProgressModal
        open={progress.open}
        steps={progress.steps}
        txHash={progress.txHash}
        onClose={progress.close}
      />
    </div>
  )
}
