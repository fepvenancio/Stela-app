export const MAX_BPS = 10_000n

export const STELA_ADDRESS = {
  sepolia: '0x0400ed08d0507b1f229c3283ecfc8567fb7240a7d0d99d5af9167993c51d062e',
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

