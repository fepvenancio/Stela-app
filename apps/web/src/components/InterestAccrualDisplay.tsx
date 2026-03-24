'use client'

import { useMemo } from 'react'
import { useInterestAccrual } from '@/hooks/useInterestAccrual'
import { formatTokenValue } from '@/lib/format'

interface InterestAccrualDisplayProps {
  interestAssets: { address: string; value: string }[]
  signedAt: number
  duration: number
}

export function InterestAccrualDisplay({ interestAssets, signedAt, duration }: InterestAccrualDisplayProps) {
  const { accruedAmounts, progressPercent, isComplete } = useInterestAccrual(interestAssets, signedAt, duration)

  const dailyRates = useMemo(() => {
    if (duration <= 0) return null
    return accruedAmounts.map((asset) => {
      const dailyRaw = (asset.total * 86400n) / BigInt(duration)
      return {
        symbol: asset.symbol,
        decimals: asset.decimals,
        dailyRaw,
      }
    })
  }, [accruedAmounts, duration])

  if (accruedAmounts.length === 0) return null

  return (
    <section className="bg-surface/20 border border-border/20 rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-accent font-mono text-xs uppercase tracking-[0.3em]">Interest Accrual</h4>
        {isComplete && (
          <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest">Fully Accrued</span>
        )}
      </div>

      <div className="space-y-4">
        {accruedAmounts.map((asset) => {
          const pct = asset.total > 0n
            ? Number((asset.accrued * 10000n) / asset.total) / 100
            : 0

          return (
            <div key={asset.address} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white">
                  Accrued: {formatTokenValue(asset.accrued.toString(), asset.decimals)} / {formatTokenValue(asset.total.toString(), asset.decimals)} {asset.symbol}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">{pct.toFixed(1)}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-green-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Daily rate */}
      {dailyRates && dailyRates.length > 0 && !isComplete && (
        <div className="pt-2 border-t border-border/10">
          {dailyRates.map((rate) => (
            <div key={rate.symbol} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Daily Rate</span>
              <span className="text-[10px] text-white font-mono">
                +{formatTokenValue(rate.dailyRaw.toString(), rate.decimals)} {rate.symbol}/day
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
