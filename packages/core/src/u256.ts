import { uint256 } from 'starknet'

export const toU256 = (n: bigint): [string, string] => {
  const { low, high } = uint256.bnToUint256(n)
  return [low.toString(), high.toString()]
}

export const fromU256 = (low: bigint, high: bigint): bigint =>
  uint256.uint256ToBN({ low, high })

export const agreementIdToHex = (u: { low: bigint; high: bigint }): string =>
  '0x' + fromU256(u.low, u.high).toString(16).padStart(64, '0')
