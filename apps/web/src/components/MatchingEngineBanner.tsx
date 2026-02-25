'use client'

interface MatchingEngineBannerProps {
  type: 'offline' | 'error'
}

const CONTENT = {
  offline: {
    title: 'Matching engine is temporarily offline',
    description: 'Intent matching is unavailable. You can still browse and fill orders manually.',
  },
  error: {
    title: 'Matching engine error',
    description: 'Something went wrong. Please try again later.',
  },
} as const

/**
 * MatchingEngineBanner — degradation banner displayed when the matching
 * engine is offline or encounters an error.
 */
export function MatchingEngineBanner({ type }: MatchingEngineBannerProps) {
  const { title, description } = CONTENT[type]

  return (
    <div className="rounded-2xl border border-nova/30 bg-nova/5 p-6 space-y-2">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nova/75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-nova" />
        </span>
        <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
          {title}
        </h3>
      </div>
      <p className="text-xs text-dust pl-6">{description}</p>
    </div>
  )
}
