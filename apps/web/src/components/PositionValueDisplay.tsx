'use client'

import { useMemo } from 'react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { Asset } from '@fepvenancio/stela-sdk'
import { usePositionValue } from '@/hooks/usePositionValue'
import { formatTokenValue } from '@/lib/format'

interface PositionValueDisplayProps {
  inscriptionId: string
  shares: bigint
  totalSupply: bigint
  debtAssets: Asset[]
  interestAssets: Asset[]
  collateralAssets: Asset[]
  signedAt: bigint
  duration: bigint
}

export function PositionValueDisplay({
  inscriptionId,
  shares,
  totalSupply,
  debtAssets,
  interestAssets,
  collateralAssets,
  signedAt,
  duration,
}: PositionValueDisplayProps) {
  const { value, safeFloor } = usePositionValue({
    inscriptionId,
    shares,
    totalSupply,
    debtAssets,
    interestAssets,
    collateralAssets,
    signedAt,
    duration,
  })

  const sharePct = useMemo(() => {
    if (!value) return '0'
    return (Number(value.shareBps) / 100).toFixed(2)
  }, [value])

  if (!value) return null

  return (
    <section className="bg-surface/20 border border-border/20 rounded-3xl p-4 sm:p-6 space-y-4">
      <h4 className="text-accent font-mono text-xs uppercase tracking-[0.3em]">Position Value</h4>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{sharePct}%</span>
        <span className="text-xs text-gray-400">of vault</span>
      </div>

      {/* Debt share */}
      {value.debt.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Your Debt Share</span>
          <div className="flex flex-wrap gap-2">
            {value.debt.map((d, i) => {
              const token = findTokenByAddress(d.asset.asset_address)
              return (
                <span key={i} className="text-xs text-white font-mono">
                  {formatTokenValue(d.proportionalValue.toString(), token?.decimals ?? 18)} {token?.symbol ?? '???'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Accrued interest */}
      {value.accrued.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Accrued Interest</span>
          <div className="flex flex-wrap gap-2">
            {value.accrued.map((a, i) => {
              const token = findTokenByAddress(a.asset.asset_address)
              return (
                <span key={i} className="text-xs text-green-500 font-mono">
                  +{formatTokenValue(a.accruedInterest.toString(), token?.decimals ?? 18)} {token?.symbol ?? '???'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Safe floor price */}
      {safeFloor && safeFloor.debtFloor.length > 0 && (
        <div className="pt-3 border-t border-border/15 space-y-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Safe Floor Price</span>
          <div className="flex flex-wrap gap-2">
            {safeFloor.debtFloor.map((d, i) => {
              const token = findTokenByAddress(d.asset.asset_address)
              const interestFloor = safeFloor.interestFloor[i]
              const interestToken = interestFloor ? findTokenByAddress(interestFloor.asset.asset_address) : null
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-xs text-white font-mono">
                    {formatTokenValue(d.proportionalValue.toString(), token?.decimals ?? 18)} {token?.symbol ?? '???'}
                  </span>
                  {interestFloor && (
                    <span className="text-[10px] text-green-500 font-mono">
                      +{formatTokenValue(interestFloor.proportionalValue.toString(), interestToken?.decimals ?? 18)} {interestToken?.symbol ?? '???'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-500">
            Minimum value including 60s dust buffer for tx delay.
          </p>
        </div>
      )}
    </section>
  )
}
