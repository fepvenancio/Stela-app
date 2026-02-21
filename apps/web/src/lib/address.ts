import { addAddressPadding, validateAndParseAddress } from 'starknet'

/** Convert any address-like value (string, bigint, number) to a hex string */
export function toHex(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return '0x' + value.toString(16)
  if (typeof value === 'number') return '0x' + value.toString(16)
  return String(value)
}

export function formatAddress(address: unknown): string {
  try {
    const hex = toHex(address)
    const padded = addAddressPadding(hex)
    return `${padded.slice(0, 6)}...${padded.slice(-4)}`
  } catch {
    return String(address).slice(0, 10) + '...'
  }
}

export function normalizeAddress(address: unknown): string {
  const hex = toHex(address)
  return addAddressPadding(validateAndParseAddress(hex))
}

export function addressesEqual(a: unknown, b: unknown): boolean {
  try {
    return normalizeAddress(a) === normalizeAddress(b)
  } catch {
    return toHex(a).toLowerCase() === toHex(b).toLowerCase()
  }
}
