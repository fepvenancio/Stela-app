import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-ash bg-abyss/50 border-edge text-chalk h-12 w-full min-w-0 rounded-2xl border px-5 py-3 text-sm transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-nova/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
