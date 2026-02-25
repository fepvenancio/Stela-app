import { STELA_ADDRESS, resolveNetwork } from '@fepvenancio/stela-sdk'
import type { Network } from '@fepvenancio/stela-sdk'

export const NETWORK: Network = resolveNetwork(process.env.NEXT_PUBLIC_NETWORK)
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_STELA_ADDRESS || STELA_ADDRESS[NETWORK]) as `0x${string}`
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.starknet-testnet.lava.build'
export const MATCHING_ENGINE_URL =
  process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || 'http://localhost:3001'
