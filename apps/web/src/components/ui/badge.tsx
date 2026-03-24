import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border-primary/20",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/20",
        outline:
          "border-border text-foreground",
        // Inscription status variants
        open: "bg-green-500/15 text-green-500 border-green-500/20",
        partial: "bg-accent/15 text-accent border-accent/20",
        filled: "bg-sky-400/15 text-sky-400 border-sky-400/20",
        repaid: "bg-green-500/15 text-green-500 border-green-500/20",
        liquidated: "bg-red-500/15 text-red-500 border-red-500/20",
        expired: "bg-gray-500/15 text-gray-500 border-gray-500/20",
        overdue: "bg-red-500/15 text-red-500 border-red-500/20",
        auctioned: "bg-red-500/15 text-red-500 border-red-500/20",
        grace_period: "bg-accent/15 text-accent border-accent/20",
        cancelled: "bg-gray-500/15 text-gray-500 border-gray-500/20",
        // Off-chain order status variants
        pending: "bg-green-500/15 text-green-500 border-green-500/20",
        matched: "bg-sky-500/15 text-sky-500 border-sky-500/20",
        settled: "bg-sky-400/15 text-sky-400 border-sky-400/20",
        // Risk badge
        atrisk: "bg-red-500/20 text-red-500 border-red-500/30 animate-pulse",
        // Network badges
        testnet: "bg-green-500/10 text-green-500 border-green-500/20",
        mainnet: "bg-accent/10 text-accent border-accent/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
