'use client'

import { useEffect, useMemo, useState } from 'react'
import { RpcProvider } from 'starknet'
import { InscriptionClient, findTokenByAddress } from '@fepvenancio/stela-sdk'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { formatTokenValue } from '@/lib/format'

interface AuctionPriceProps {
  inscriptionId: bigint
  debtTokenAddress: string
  originalDebt: bigint
  /** Polling interval in ms (default 30000) */
  pollInterval?: number
}

/**
 * Displays the current auction price, polling the chain periodically.
 * Shows price, token symbol, and percentage of original debt.
 */
export function AuctionPrice({
  inscriptionId,
  debtTokenAddress,
  originalDebt,
  pollInterval = 30000,
}: AuctionPriceProps) {
  const [price, setPrice] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(true)

  const client = useMemo(() => {
    const provider = new RpcProvider({ nodeUrl: RPC_URL })
    return new InscriptionClient({ stelaAddress: CONTRACT_ADDRESS, provider })
  }, [])

  useEffect(() => {
    async function fetchPrice() {
      try {
        const p = await client.getAuctionPrice(inscriptionId, 0)
        setPrice(p)
      } catch {
        // Price fetch failed — auction may have ended
      } finally {
        setLoading(false)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, pollInterval)
    return () => clearInterval(interval)
  }, [client, inscriptionId, pollInterval])

  const token = findTokenByAddress(debtTokenAddress)
  const symbol = token?.symbol ?? 'tokens'
  const decimals = token?.decimals ?? 18

  if (loading) {
    return <div className="text-xs text-dust">Loading auction price...</div>
  }

  if (price === null) {
    return <div className="text-xs text-dust">Auction price unavailable</div>
  }

  const pctOfDebt = originalDebt > 0n ? Number((price * 10000n) / originalDebt) / 100 : 0
  const formattedPrice = formatTokenValue(price.toString(), decimals)

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <span className="text-[10px] text-dust uppercase tracking-widest">Current Price</span>
        <span className="text-lg font-display text-chalk truncate">
          {formattedPrice} {symbol}
        </span>
      </div>
      <div className="text-xs text-dust">
        {pctOfDebt.toFixed(1)}% of original debt
      </div>
      {/* Declining price bar */}
      <div className="h-2 w-full rounded-full bg-edge/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-star transition-all duration-1000"
          style={{ width: `${Math.min(100, pctOfDebt)}%` }}
        />
      </div>
    </div>
  )
}
