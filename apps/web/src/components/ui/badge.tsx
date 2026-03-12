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
          "border-edge text-foreground",
        // Inscription status variants
        open: "bg-aurora/15 text-aurora border-aurora/20",
        partial: "bg-star/15 text-star border-star/20",
        filled: "bg-nebula/15 text-nebula border-nebula/20",
        repaid: "bg-aurora/15 text-aurora border-aurora/20",
        liquidated: "bg-nova/15 text-nova border-nova/20",
        expired: "bg-ash/15 text-ash border-ash/20",
        overdue: "bg-nova/15 text-nova border-nova/20",
        auctioned: "bg-nova/15 text-nova border-nova/20",
        grace_period: "bg-star/15 text-star border-star/20",
        cancelled: "bg-ash/15 text-ash border-ash/20",
        // Off-chain order status variants
        pending: "bg-aurora/15 text-aurora border-aurora/20",
        matched: "bg-cosmic/15 text-cosmic border-cosmic/20",
        settled: "bg-nebula/15 text-nebula border-nebula/20",
        // Risk badge
        atrisk: "bg-nova/20 text-nova border-nova/30 animate-pulse",
        // Network badges
        testnet: "bg-aurora/10 text-aurora border-aurora/20",
        mainnet: "bg-star/10 text-star border-star/20",
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
