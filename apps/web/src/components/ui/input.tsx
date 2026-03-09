import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-ash bg-abyss border-edge text-chalk h-10 w-full min-w-0 rounded-md border px-3 py-2 text-sm transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-nova/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
