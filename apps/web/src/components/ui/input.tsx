import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-white transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-700 focus-visible:outline-none focus-visible:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-red-500/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
