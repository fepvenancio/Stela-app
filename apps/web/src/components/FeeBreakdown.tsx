'use client'

import { useAccount } from '@starknet-react/core'
import { useFeePreview } from '@/hooks/useFeePreview'
import type { FeePreview } from '@/hooks/useFeePreview'

/* ── Helpers ───────────────────────────────────────────── */

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

function formatSavingsAmount(bps: number, debtAmount?: bigint, decimals?: number): string | null {
  if (!debtAmount || debtAmount === 0n || bps <= 0 || decimals == null) return null
  const saved = (debtAmount * BigInt(bps)) / 10000n
  if (saved === 0n) return null
  const divisor = 10n ** BigInt(decimals)
  const whole = saved / divisor
  const frac = saved % divisor
  const wholeStr = whole.toString()
  if (frac === 0n) return wholeStr
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '')
  return fracStr ? `${wholeStr}.${fracStr}` : wholeStr
}

const TIER_LABELS = ['--', '$10K', '$25K', '$50K', '$100K', '$250K', '$500K', '$1M+']

/* ── Component ─────────────────────────────────────────── */

interface FeeBreakdownProps {
  type: 'lending' | 'swap'
  /** Raw debt/swap amount for savings calculation */
  debtAmount?: bigint
  /** Decimals of the debt token */
  debtDecimals?: number
  /** Symbol of the debt token for savings display */
  debtSymbol?: string
}

export function FeeBreakdown({ type, debtAmount, debtDecimals, debtSymbol }: FeeBreakdownProps) {
  const { address } = useAccount()
  const fee = useFeePreview(type)

  const hasDiscount = fee.discountPercent > 0
  const savings = formatSavingsAmount(fee.savingsBps, debtAmount, debtDecimals)

  return (
    <div className="rounded-lg border border-border/15 bg-surface/40 overflow-clip">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/10">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          Protocol Fee
        </span>
        <span className="font-mono text-sm text-white shrink-0">
          {hasDiscount ? (
            <>
              <span className="text-gray-400 line-through mr-1.5">{bpsToPercent(fee.totalBaseBps)}</span>
              <span className="text-green-500">{bpsToPercent(fee.effectiveTotalBps)}</span>
            </>
          ) : (
            bpsToPercent(fee.totalBaseBps)
          )}
        </span>
      </div>

      {/* Detail rows */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Treasury line */}
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-gray-400 shrink-0">Treasury</span>
          <span className="font-mono text-white text-right">
            {hasDiscount ? (
              <>
                <span className="text-gray-400 line-through mr-1">{bpsToPercent(fee.treasuryBps)}</span>
                <span className="text-green-500">{bpsToPercent(fee.effectiveTreasuryBps)}</span>
              </>
            ) : (
              bpsToPercent(fee.treasuryBps)
            )}
          </span>
        </div>

        {/* Relayer line */}
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-gray-400 shrink-0">Relayer</span>
          <span className="font-mono text-white text-right">
            {bpsToPercent(fee.relayerBps)}
            <span className="text-gray-500 ml-1 text-[10px]">(fixed)</span>
          </span>
        </div>

        {/* Discount line */}
        {address && hasDiscount && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/10 gap-2">
            <span className="text-gray-400 shrink-0">Discount</span>
            <span className="font-mono text-accent text-right">
              -{fee.discountPercent}%
              <span className="text-gray-500 ml-1 text-[10px]">
                ({Number(fee.nftBalance)} NFT{fee.nftBalance !== 1n ? 's' : ''}
                {fee.volumeTier > 0 && <> · Tier {fee.volumeTier}</>})
              </span>
            </span>
          </div>
        )}

        {/* Savings line */}
        {address && hasDiscount && savings && debtSymbol && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">You save</span>
            <span className="font-mono text-green-500">
              {savings} {debtSymbol}
            </span>
          </div>
        )}

        {/* CTA for non-holders */}
        {address && !hasDiscount && !fee.isLoading && (
          <div className="pt-1.5 border-t border-border/10">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Hold a <span className="text-accent font-medium">Genesis NFT</span> for up to 50% fee discount
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
