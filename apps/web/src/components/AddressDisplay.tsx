'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatAddress, normalizeAddress, toHex } from "@/lib/address"
import { cn } from "@/lib/utils"

export function AddressDisplay({ address, className }: { address: unknown; className?: string }) {
  const hex = toHex(address)
  let fullAddress: string
  try {
    fullAddress = normalizeAddress(hex)
  } catch {
    fullAddress = hex
  }
  return (
    <Tooltip>
      <TooltipTrigger className={cn("font-mono cursor-default", className)}>
        {formatAddress(address)}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs">{fullAddress}</p>
      </TooltipContent>
    </Tooltip>
  )
}
