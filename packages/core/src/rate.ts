/**
 * Compute interest rate as a ratio of interest value to debt value.
 * Skips ERC721 assets (no fungible value). Returns null if debt total is zero.
 * Used by both the bot (settlement priority) and frontend (rank display).
 */
export function computeInterestRate(
  debtAssets: { asset_type: string; value: string }[],
  interestAssets: { asset_type: string; value: string }[],
): number | null {
  let debtTotal = 0n
  let interestTotal = 0n
  for (const a of debtAssets) {
    if (a.asset_type === 'ERC721') continue
    debtTotal += BigInt(a.value || '0')
  }
  for (const a of interestAssets) {
    if (a.asset_type === 'ERC721') continue
    interestTotal += BigInt(a.value || '0')
  }
  if (debtTotal === 0n) return null
  return Number((interestTotal * 1_000_000n) / debtTotal) / 1_000_000
}
