'use client'

import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatAddress } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'

interface AssetItem {
  asset_address: string
  asset_type: string
  value: string | null
  token_id?: string | null
}

interface CompactAssetSummaryProps {
  assets: AssetItem[]
}

export function CompactAssetSummary({ assets }: CompactAssetSummaryProps) {
  if (assets.length === 0) return <span className="text-ash/50 text-[10px]">None</span>

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {assets.map((a, i) => {
        const token = findTokenByAddress(a.asset_address)
        const symbol = token?.symbol ?? formatAddress(a.asset_address)
        const decimals = token?.decimals ?? 18
        const isNFT = a.asset_type === 'ERC721'
        const display = isNFT
          ? `${symbol}${a.token_id && a.token_id !== '0' ? ` #${a.token_id}` : ''}`
          : `${formatTokenValue(a.value, decimals)} ${symbol}`

        return (
          <div key={i} className="flex items-center gap-1.5">
            <TokenAvatarByAddress address={a.asset_address} size={14} />
            <span className="text-xs font-medium text-chalk">{display}</span>
          </div>
        )
      })}
    </div>
  )
}
