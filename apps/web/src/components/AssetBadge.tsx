import { formatAddress } from '@/lib/address'

interface AssetBadgeProps {
  address: string
  assetType: string
  value?: string
  tokenId?: string
}

export function AssetBadge({ address, assetType, value, tokenId }: AssetBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-surface border border-edge">
      <span className="font-medium text-star">{assetType}</span>
      <span className="font-mono text-ash">{formatAddress(address)}</span>
      {value && <span className="text-chalk">{value}</span>}
      {tokenId && tokenId !== '0' && (
        <span className="text-dust">#{tokenId}</span>
      )}
    </span>
  )
}
