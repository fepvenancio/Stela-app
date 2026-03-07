import { uint256 } from 'starknet'

const U128_MAX = (1n << 128n) - 1n
const U256_MAX = (1n << 256n) - 1n

export const toU256 = (n: bigint): [string, string] => {
  if (n < 0n || n > U256_MAX) throw new RangeError(`Value out of u256 range: ${n}`)
  const { low, high } = uint256.bnToUint256(n)
  return [low.toString(), high.toString()]
}

export const fromU256 = (u: { low: bigint; high: bigint }): bigint => {
  if (u.low < 0n || u.low > U128_MAX || u.high < 0n || u.high > U128_MAX) {
    throw new RangeError('Invalid u256 component: low and high must be u128')
  }
  return uint256.uint256ToBN(u)
}

export const inscriptionIdToHex = (u: { low: bigint; high: bigint }): string =>
  '0x' + fromU256(u).toString(16).padStart(64, '0')

/** Normalize a StarkNet address to 64-character padded hex (with 0x) */
export const normalizeAddress = (address: string): string => {
  const stripped = address.replace(/^0x0*/i, '').toLowerCase()
  if (stripped === '' || stripped === '0') return '0x' + '0'.padStart(64, '0')
  return '0x' + stripped.padStart(64, '0')
}

/** Standardize a hex string (e.g. tx hash) without padding to 64 chars */
export const standardizeHex = (hex: string): string => {
  return '0x' + hex.replace(/^0x0*/i, '').toLowerCase()
}
