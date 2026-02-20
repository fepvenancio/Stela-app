export const MAX_BPS = 10_000n
export const VIRTUAL_SHARE_OFFSET = 10_000_000_000_000_000n // 1e16

export const STELA_ADDRESS = {
  sepolia: '0x0',
  mainnet: '0x0',
} as const

export type Network = keyof typeof STELA_ADDRESS

const VALID_NETWORKS = Object.keys(STELA_ADDRESS) as Network[]

/** Validate and return a Network value, defaulting to 'sepolia' */
export function resolveNetwork(raw?: string): Network {
  if (raw && VALID_NETWORKS.includes(raw as Network)) return raw as Network
  if (raw) console.warn(`Invalid NETWORK "${raw}", falling back to sepolia`)
  return 'sepolia'
}
