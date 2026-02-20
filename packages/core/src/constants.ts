export const MAX_BPS = 10_000n
export const VIRTUAL_SHARE_OFFSET = 10_000_000_000_000_000n // 1e16

export const STELA_ADDRESS = {
  sepolia: '0x05abdecf7acf10813db62a1b9282ccf07f326b49f6f6c8ef9dd38b33d7c1d8f6',
  mainnet: '0x0',
} as const

export type Network = keyof typeof STELA_ADDRESS

const VALID_NETWORKS = Object.keys(STELA_ADDRESS) as Network[]

/** Validate and return a Network value, defaulting to 'sepolia' */
export function resolveNetwork(raw?: string): Network {
  const trimmed = raw?.trim()
  if (trimmed && VALID_NETWORKS.includes(trimmed as Network)) return trimmed as Network
  if (trimmed) console.warn(`Invalid NETWORK "${trimmed}", falling back to sepolia`)
  return 'sepolia'
}
