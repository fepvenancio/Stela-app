/** Format a raw token value (string) given its decimals */
export function formatTokenValue(raw: string | null, decimals: number): string {
  if (!raw || raw === '0') return '0'
  const n = BigInt(raw)
  if (decimals === 0) return n.toString()
  const divisor = 10n ** BigInt(decimals)
  const whole = n / divisor
  const frac = n % divisor
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole}.${fracStr}`
}

/** Format duration in seconds to human-readable */
export function formatDuration(seconds: number | bigint): string {
  const s = Number(seconds)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h`
}

/** Format a unix timestamp (seconds) to locale string */
export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '--'
  return new Date(Number(ts) * 1000).toLocaleString()
}

/** Truncate an address for display: 0x1a2b...3c4d */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
