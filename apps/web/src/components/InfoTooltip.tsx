'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  content: string | React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function InfoTooltip({ content, side = 'top', className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-ash/60 hover:text-dust transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-star/50 ${className ?? ''}`}
          aria-label="More information"
        >
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-left text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
