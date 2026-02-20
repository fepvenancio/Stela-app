export const MAX_BPS = 10_000n
export const VIRTUAL_SHARE_OFFSET = 10_000_000_000_000_000n // 1e16

export const STELA_ADDRESS = {
  sepolia: '0x0',
  mainnet: '0x0',
} as const

export type Network = keyof typeof STELA_ADDRESS
