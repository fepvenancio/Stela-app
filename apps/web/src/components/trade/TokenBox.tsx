import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenAvatar } from '@/components/TokenAvatar'
import { formatTokenValue } from '@/lib/format'

export function TokenBox({
  label,
  accentClass,
  borderClass,
  bgClass,
  asset,
  balance,
  onTokenClick,
  onAmountChange,
  onMaxClick,
}: {
  label: string
  accentClass: string
  borderClass: string
  bgClass: string
  asset: AssetInputValue
  balance?: bigint
  onTokenClick: () => void
  onAmountChange: (val: string) => void
  onMaxClick?: () => void
}) {
  const token = asset.asset ? findTokenByAddress(asset.asset) : null

  return (
    <div className={`${bgClass} border ${borderClass} rounded-lg p-3 sm:p-4 overflow-hidden`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${accentClass}`}>{label}</span>
        {token && balance !== undefined && balance > 0n && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-mono">
              {formatTokenValue(balance.toString(), token.decimals)}
            </span>
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-[10px] text-accent hover:text-accent/80 font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onTokenClick}
          className="flex items-center gap-1.5 sm:gap-2 h-10 px-2 sm:px-3 rounded-md bg-surface/60 border border-border/40 text-sm transition-colors hover:bg-surface-hover hover:border-white/20 cursor-pointer shrink-0"
        >
          {token ? (
            <>
              <TokenAvatar token={token} size={20} />
              <span className="text-white font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-gray-400">Select</span>
          )}
          <svg className="text-gray-500 ml-1" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={asset.value}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || /^\d*\.?\d{0,18}$/.test(raw)) onAmountChange(raw)
          }}
          className="flex-1 min-w-0 text-right text-lg sm:text-xl font-mono bg-transparent outline-none text-white placeholder:text-gray-500/40"
        />
      </div>
    </div>
  )
}
