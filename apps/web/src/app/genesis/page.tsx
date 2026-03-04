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

const MINT_STEPS = [
  { label: 'Approve STRK', description: 'Approve token spend for mint' },
  { label: 'Mint NFT', description: 'Mint Genesis NFT to your wallet' },
  { label: 'Confirming', description: 'Waiting for confirmation' },
]

const STRK_DECIMALS = 18

function formatStrk(raw: bigint): string {
  const whole = raw / 10n ** BigInt(STRK_DECIMALS)
  return whole.toLocaleString()
}

function readU256(data: unknown): bigint {
  if (data == null) return 0n
  if (typeof data === 'bigint') return data
  if (typeof data === 'number') return BigInt(data)
  if (typeof data === 'string') return BigInt(data)
  return 0n
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
  const soldOut = totalMinted >= 300n

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
          300 unique NFTs that earn a share of every protocol fee on Stela.
          Settle fees (15 BPS) and redeem fees (7 BPS) are split across all 300 holders.
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
              {totalMinted.toString()} <span className="text-sm text-dust">/ 300</span>
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
            style={{ width: `${Math.min((Number(totalMinted) / 300) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-ash">{((Number(totalMinted) / 300) * 100).toFixed(1)}% minted</span>
          <span className="text-[10px] text-ash">{300 - Number(totalMinted)} remaining</span>
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
                <p className="text-sm text-nova">Sold out! All 300 Genesis NFTs have been minted.</p>
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
                      onClick={() => setQuantity(Math.min(5, quantity + 1))}
                      disabled={quantity >= 5}
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
              <span className="text-lg font-display text-star">15 BPS</span>
              <span className="text-xs text-dust block mt-1">0.15% of each settled inscription</span>
            </div>
            <div className="p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
              <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Redeem Fee</span>
              <span className="text-lg font-display text-star">7 BPS</span>
              <span className="text-xs text-dust block mt-1">0.07% of each share redemption</span>
            </div>
          </div>
          <p className="text-xs text-dust leading-relaxed">
            Fees accumulate in the vault and are split equally across all 300 Genesis NFTs.
            Claim anytime — there is no expiry on accumulated fees.
          </p>
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
