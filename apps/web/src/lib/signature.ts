/**
 * Shared signature utilities for parsing and formatting StarkNet signatures.
 *
 * Used by useInstantSettle, useMultiSettle, and useSignOrder hooks.
 */

/**
 * Format a wallet signature response (array or {r, s} object) into a string array.
 * Converts bigint values to hex strings.
 */
export function formatSig(signature: unknown): string[] {
  if (Array.isArray(signature)) {
    return signature.map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s))
  }
  const sig = signature as { r: unknown; s: unknown }
  return [sig.r, sig.s].map((s: unknown) => typeof s === 'bigint' ? '0x' + s.toString(16) : String(s))
}

/**
 * Parse a stored signature (string, JSON string, or string array) into a string array.
 * Handles formats: `[r, s]` array, `"[r, s]"` JSON, `"{r, s}"` JSON object, `"r,s"` CSV.
 */
export function parseSigToArray(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length < 1 || !parsed.every((s: unknown) => typeof s === 'string' || typeof s === 'number'))
        throw new Error('Invalid signature array format')
      return parsed.map(String)
    }
    if (raw.startsWith('{')) {
      const obj = JSON.parse(raw) as Record<string, unknown>
      if (typeof obj.r !== 'string' || typeof obj.s !== 'string')
        throw new Error('Invalid signature object format: missing r or s')
      return [obj.r, obj.s]
    }
    const parts = raw.split(',')
    if (parts.length < 2) throw new Error('Invalid signature CSV: expected at least 2 elements')
    return parts
  }
  throw new Error('Invalid signature format')
}
