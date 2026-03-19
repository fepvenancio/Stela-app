interface BotRankBadgeProps {
  rank: number
}

export function BotRankBadge({ rank }: BotRankBadgeProps) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-nebula/15 text-nebula"
      title={`Bot settlement priority #${rank} — lowest interest rate settles first`}
    >
      Bot #{rank}
    </span>
  )
}
