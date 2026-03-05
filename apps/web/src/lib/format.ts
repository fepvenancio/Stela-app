/** Format a raw token value (string) given its decimals.
 *  Output: thousands-separated whole part, up to 3 decimal places. */
export function formatTokenValue(raw: string | null, decimals: number): string {
  if (!raw || raw === '0') return '0'
  const n = BigInt(raw)
  if (decimals === 0) return addThousandsSep(n.toString())
  const divisor = 10n ** BigInt(decimals)
  const whole = n / divisor
  const frac = n % divisor
  const wholeStr = addThousandsSep(whole.toString())
  if (frac === 0n) return wholeStr
  // Pad to full decimals, trim trailing zeros, cap at 3
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 3).replace(/0+$/, '')
  return fracStr ? `${wholeStr}.${fracStr}` : wholeStr
}

function addThousandsSep(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Format a human-typed amount string (e.g. "1000.5") with thousands separators */
export function formatDisplayAmount(value: string): string {
  if (!value || value === '0') return '0'
  const [whole, frac] = value.split('.')
  const wholeFormatted = addThousandsSep(whole || '0')
  return frac !== undefined ? `${wholeFormatted}.${frac}` : wholeFormatted
}

/** Format duration in seconds to human-readable */
export function formatDuration(seconds: number | bigint): string {
  const s = Number(seconds)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h`
}

/** Safely read a u256 value from contract read results */
export function readU256(data: unknown): bigint {
  if (data == null) return 0n
  if (typeof data === 'bigint') return data
  if (typeof data === 'number') return BigInt(data)
  if (typeof data === 'string') return BigInt(data)
  return 0n
}

/** Format a unix timestamp (seconds) to locale string */
export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '--'
  return new Date(Number(ts) * 1000).toLocaleString()
}