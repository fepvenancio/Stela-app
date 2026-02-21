'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatAddress, normalizeAddress, toHex } from "@/lib/address"
import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/CopyButton"

export function AddressDisplay({ address, className }: { address: unknown; className?: string }) {
  const hex = toHex(address)
  let fullAddress: string
  try {
    fullAddress = normalizeAddress(hex)
  } catch {
    fullAddress = hex
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger className="font-mono cursor-default">
          {formatAddress(address)}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{fullAddress}</p>
        </TooltipContent>
      </Tooltip>
      <CopyButton value={fullAddress} label="Address" />
    </span>
  )
}
