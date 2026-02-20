import { addAddressPadding, validateAndParseAddress } from 'starknet'

export function formatAddress(address: string): string {
  const padded = addAddressPadding(address)
  return `${padded.slice(0, 6)}...${padded.slice(-4)}`
}

export function normalizeAddress(address: string): string {
  return addAddressPadding(validateAndParseAddress(address))
}

export function addressesEqual(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}
