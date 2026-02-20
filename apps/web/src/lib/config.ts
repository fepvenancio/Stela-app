import type { Network } from '@stela/core'
import { STELA_ADDRESS } from '@stela/core'

export const NETWORK: Network = (process.env.NEXT_PUBLIC_NETWORK as Network) ?? 'sepolia'
export const CONTRACT_ADDRESS = STELA_ADDRESS[NETWORK]
