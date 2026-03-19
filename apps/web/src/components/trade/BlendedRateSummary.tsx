'use client'

interface WeightedEntry {
  /** APR or rate percentage. Null entries are excluded. */
  apr: number | null
  /** Raw debt amount (bigint as sum of ERC20 values). Used for weighting. */
  debtAmount: bigint
}

interface BlendedRateSummaryProps {
  /** Per-trade APR and debt amount for weighted average computation */
  entries: WeightedEntry[]
  /** Mode determines label text */
  mode: 'lending' | 'swap'
}

export function BlendedRateSummary({ entries, mode }: BlendedRateSummaryProps) {
  // Filter to entries with valid APR and non-zero debt
  const valid = entries.filter(
    (e): e is { apr: number; debtAmount: bigint } =>
      e.apr !== null && e.debtAmount > 0n
  )

  // Only show when 2+ orders (per UI-SPEC: "Only show when 2+ orders are selected for multi-fill")
  if (valid.length < 2) return null

  // Debt-amount-weighted average APR (per research Example 4)
  let totalDebt = 0n
  let weightedSum = 0
  for (const v of valid) {
    weightedSum += v.apr * Number(v.debtAmount)
    totalDebt += v.debtAmount
  }
  if (totalDebt === 0n) return null
  const blended = weightedSum / Number(totalDebt)

  const label = mode === 'swap' ? 'Blended Rate' : 'Blended APR'

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface/20 border border-edge/20">
      <span className="text-[10px] uppercase tracking-widest font-bold text-dust">
        {label}
      </span>
      <span className="font-mono text-sm text-nebula">
        {blended.toFixed(2)}%
      </span>
    </div>
  )
}
