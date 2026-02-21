'use client'

import { findTokenByAddress } from '@stela/core'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress, normalizeAddress } from '@/lib/address'

interface AssetBadgeProps {
  address: string
  assetType: string
  value?: string
  tokenId?: string
}

export function AssetBadge({ address, assetType, value, tokenId }: AssetBadgeProps) {
  let fullAddress: string
  try {
    fullAddress = normalizeAddress(address)
  } catch {
    fullAddress = address
  }

  const token = findTokenByAddress(address)
  const displayName = token?.symbol ?? formatAddress(address)

  return (
    <Badge variant="outline" className="gap-2 px-3 py-1.5">
      <span className="font-medium text-star">{assetType}</span>
      <Tooltip>
        <TooltipTrigger className="font-mono text-chalk cursor-default">
          {displayName}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{fullAddress}</p>
          {token && <p className="text-xs text-dust">{token.name}</p>}
        </TooltipContent>
      </Tooltip>
      {value && <span className="text-chalk">{value}</span>}
      {tokenId && tokenId !== '0' && (
        <span className="text-dust">#{tokenId}</span>
      )}
    </Badge>
  )
}
