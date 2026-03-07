'use client'

import { findTokenByAddress, formatTokenValue } from '@fepvenancio/stela-sdk'
import { TokenAvatar, TokenAvatarByAddress } from '@/components/TokenAvatar'
import { formatAddress } from '@/lib/address'
import { formatDisplayAmount } from '@/lib/format'
import type { AssetInputValue } from '@/components/AssetInput'

type AssetRole = 'debt' | 'collateral' | 'interest'

const ROLE_META: Record<AssetRole, { label: string; short: string; color: string; bgClass: string; borderClass: string; textClass: string }> = {
  debt: {
    label: 'Borrow',
    short: 'Debt',
    color: 'nebula',
    bgClass: 'bg-nebula/10',
    borderClass: 'border-nebula/25',
    textClass: 'text-nebula',
  },
  collateral: {
    label: 'Collateral',
    short: 'Collat.',
    color: 'star',
    bgClass: 'bg-star/10',
    borderClass: 'border-star/25',
    textClass: 'text-star',
  },
  interest: {
    label: 'Interest',
    short: 'Interest',
    color: 'aurora',
    bgClass: 'bg-aurora/10',
    borderClass: 'border-aurora/25',
    textClass: 'text-aurora',
  },
}

export function AssetRow({
  asset,
  role,
  onRemove,
}: {
  asset: AssetInputValue
  role: AssetRole
  onRemove: () => void
}) {
  // Simple check for now, can be improved with props if needed
  const token = findTokenByAddress(asset.asset)
  const meta = ROLE_META[role]
  const isNft = asset.asset_type === 'ERC721' || asset.asset_type === 'ERC1155'

  return (
    <div className="group flex items-center px-4 py-3 hover:bg-surface/20 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-edge/30">
          {token ? (
            <TokenAvatar token={token} size={20} />
          ) : (
            <TokenAvatarByAddress address={asset.asset} size={20} />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-chalk font-medium truncate">
            {token?.name || formatAddress(asset.asset)}
          </span>
          <span className="text-[10px] text-dust font-mono uppercase">
            {token?.symbol || 'Custom'}
          </span>
        </div>
      </div>

      <div className="w-32 text-center">
        <span className="text-sm text-chalk font-mono">
          {isNft ? (
            <>#{asset.token_id}</>
          ) : (
            <>{formatDisplayAmount(asset.value || '0')}</>
          )}
        </span>
      </div>

      <div className="w-32 flex justify-center">
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
          {meta.short}
        </span>
      </div>

      <div className="w-10 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ash hover:text-nova hover:bg-nova/10 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Remove asset"
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
