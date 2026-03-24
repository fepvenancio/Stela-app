'use client'

import { cn } from '@/lib/utils'

const SKELETON_WIDTHS = [85, 62, 74, 55, 90, 48, 68, 80]

export function BookSkeleton() {
  return (
    <div className="w-full">
      {/* Header skeleton */}
      <div className="flex items-center h-7 px-3 border-b border-border/10">
        <div className="h-2.5 w-12 bg-edge/10 rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-2.5 w-16 bg-edge/10 rounded animate-pulse" />
        <div className="hidden md:block h-2.5 w-16 bg-edge/10 rounded animate-pulse ml-4" />
      </div>

      {/* Row skeletons */}
      {SKELETON_WIDTHS.map((width, i) => (
        <div key={i} className="relative flex items-center h-8 px-3">
          {/* Depth bar skeleton */}
          <div
            className="absolute inset-y-0 right-0 bg-edge/10 animate-pulse"
            style={{ width: `${width}%`, animationDelay: `${i * 75}ms` }}
          />

          {/* Content skeleton */}
          <div className="relative z-[1] flex items-center w-full gap-2">
            <div
              className={cn('h-3 rounded bg-edge/15 animate-pulse w-[60px]')}
              style={{ animationDelay: `${i * 75 + 30}ms` }}
            />
            <div className="flex-1" />
            <div
              className="h-3 rounded bg-edge/15 animate-pulse w-[80px]"
              style={{ animationDelay: `${i * 75 + 60}ms` }}
            />
            <div
              className="hidden md:block h-3 rounded bg-edge/15 animate-pulse w-[70px]"
              style={{ animationDelay: `${i * 75 + 90}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
