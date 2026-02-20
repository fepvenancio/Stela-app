/** Convert human-readable amount (e.g. "1.5") to on-chain value using decimals */
export function parseAmount(humanAmount: string, decimals: number): bigint {
  if (!humanAmount || humanAmount === '.' || humanAmount === '') return 0n
  const parts = humanAmount.split('.')
  const whole = parts[0] ?? '0'
  const frac = (parts[1] ?? '').padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + frac)
}
