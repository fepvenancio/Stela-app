'use client'

import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  className?: string
  label?: string
}

export function CopyButton({ value, className, label = 'Value' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 2000)
  }, [value, label])

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); copy() }}
      className={cn(
        'inline-flex items-center justify-center p-1 rounded hover:bg-surface/60 transition-colors text-ash hover:text-chalk',
        className
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="size-3.5 text-star" /> : <Copy className="size-3.5" />}
    </button>
  )
}
