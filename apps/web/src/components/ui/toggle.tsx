"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-star/20 data-[state=on]:text-star data-[state=on]:border-star/50 data-[state=on]:shadow-[0_0_10px_-3px_rgba(232,168,37,0.3)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-star focus-visible:ring-star/50 focus-visible:ring-[3px] outline-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent text-dust hover:bg-white/5 hover:text-chalk",
        outline:
          "border border-edge bg-transparent text-dust shadow-xs hover:border-edge-bright hover:text-chalk data-[state=on]:border-star",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
