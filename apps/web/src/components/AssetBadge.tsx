import { formatAddress } from '@/lib/address'

interface AssetBadgeProps {
  address: string
  assetType: string
  value?: string
  tokenId?: string
}

export function AssetBadge({ address, assetType, value, tokenId }: AssetBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-neutral-800">
      <span className="font-medium">{assetType}</span>
      <span className="text-neutral-400">{formatAddress(address)}</span>
      {value && <span>: {value}</span>}
      {tokenId && tokenId !== '0' && <span>#{tokenId}</span>}
    </span>
  )
}
