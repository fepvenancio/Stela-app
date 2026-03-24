import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium leading-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-gray-200 font-bold text-xs uppercase tracking-[0.15em] shadow-xl shadow-white/5",
        destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500/20",
        outline: "border border-border bg-transparent text-gray-400 hover:text-white hover:border-white/20",
        secondary: "bg-surface border border-border text-gray-400 hover:text-white hover:bg-white/[0.02]",
        ghost: "text-gray-500 hover:bg-white/5 hover:text-white",
        link: "text-accent underline-offset-4 hover:underline",
        accent: "bg-accent text-white hover:bg-accent/80 shadow-xl shadow-accent/20",
      },
      size: {
        default: "h-10 sm:h-9 px-4 py-2 rounded-xl has-[>svg]:px-3",
        xs: "h-8 sm:h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 sm:h-8 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 sm:h-10 rounded-xl px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-2xl px-8 text-sm font-bold",
        icon: "size-10 sm:size-9 rounded-xl",
        "icon-xs": "size-8 sm:size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 sm:size-8 rounded-xl",
        "icon-lg": "size-11 sm:size-10 rounded-xl",
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
