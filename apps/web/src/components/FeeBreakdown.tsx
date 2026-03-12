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
    <div className="rounded-lg border border-edge/15 bg-abyss/40 overflow-clip">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge/10">
        <span className="text-[10px] text-dust uppercase tracking-widest font-bold">
          Protocol Fee
        </span>
        <span className="font-mono text-sm text-chalk">
          {hasDiscount ? (
            <>
              <span className="text-dust line-through mr-1.5">{bpsToPercent(fee.totalBaseBps)}</span>
              <span className="text-aurora">{bpsToPercent(fee.effectiveTotalBps)}</span>
            </>
          ) : (
            bpsToPercent(fee.totalBaseBps)
          )}
        </span>
      </div>

      {/* Detail rows */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Treasury line */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-dust">Treasury</span>
          <span className="font-mono text-chalk">
            {hasDiscount ? (
              <>
                <span className="text-dust line-through mr-1">{fee.treasuryBps}</span>
                <span className="text-aurora">{fee.effectiveTreasuryBps}</span>
              </>
            ) : (
              fee.treasuryBps
            )}
            <span className="text-dust ml-0.5">bps</span>
          </span>
        </div>

        {/* Relayer line */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-dust">Relayer</span>
          <span className="font-mono text-chalk">
            {fee.relayerBps}
            <span className="text-dust ml-0.5">bps</span>
            <span className="text-ash ml-1 text-[10px]">(fixed)</span>
          </span>
        </div>

        {/* Discount line */}
        {address && hasDiscount && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-edge/10">
            <span className="text-dust">Discount</span>
            <span className="font-mono text-star">
              -{fee.discountPercent}%
              <span className="text-ash ml-1 text-[10px]">
                ({Number(fee.nftBalance)} NFT{fee.nftBalance !== 1n ? 's' : ''}
                {fee.volumeTier > 0 && <> · Tier {fee.volumeTier}</>})
              </span>
            </span>
          </div>
        )}

        {/* Savings line */}
        {address && hasDiscount && savings && debtSymbol && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-dust">You save</span>
            <span className="font-mono text-aurora">
              {savings} {debtSymbol}
            </span>
          </div>
        )}

        {/* CTA for non-holders */}
        {address && !hasDiscount && !fee.isLoading && (
          <div className="pt-1.5 border-t border-edge/10">
            <p className="text-[10px] text-dust leading-relaxed">
              Hold a <span className="text-star font-medium">Genesis NFT</span> for up to 50% fee discount
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
