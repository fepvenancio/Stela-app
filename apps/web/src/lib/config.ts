import { STELA_ADDRESS, resolveNetwork } from '@stela/core'
import type { Network } from '@stela/core'

export const NETWORK: Network = resolveNetwork(process.env.NEXT_PUBLIC_NETWORK)
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_STELA_ADDRESS || STELA_ADDRESS[NETWORK]) as `0x${string}`
