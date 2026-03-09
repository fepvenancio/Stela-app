import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium leading-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-edge bg-transparent text-dust hover:text-chalk hover:border-edge-bright",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gold: "bg-star text-void hover:bg-star-bright border border-star-dim/50",
        aurora: "bg-aurora text-void hover:bg-aurora/90 border border-aurora/30",
        nova: "bg-nova text-white hover:bg-nova/90 border border-nova/30",
        cosmic: "bg-cosmic text-white hover:bg-cosmic/90 border border-cosmic/30",
      },
      size: {
        default: "h-10 sm:h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-8 sm:h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 sm:h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 sm:h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-md px-6 text-sm font-semibold",
        icon: "size-10 sm:size-9",
        "icon-xs": "size-8 sm:size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 sm:size-8",
        "icon-lg": "size-11 sm:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
