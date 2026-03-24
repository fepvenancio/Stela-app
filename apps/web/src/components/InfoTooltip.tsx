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
          className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface/80 border border-border/40 text-gray-500/80 hover:text-gray-400 hover:border-white/20 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${className ?? ''}`}
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
