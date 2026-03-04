import { STELA_ADDRESS, resolveNetwork } from '@fepvenancio/stela-sdk'
import type { Network } from '@fepvenancio/stela-sdk'

export const NETWORK: Network = resolveNetwork(process.env.NEXT_PUBLIC_NETWORK)
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_STELA_ADDRESS || STELA_ADDRESS[NETWORK]) as `0x${string}`

const DEFAULT_RPC: Record<Network, string> = {
  sepolia: 'https://api.cartridge.gg/x/starknet/sepolia',
  mainnet: 'https://api.cartridge.gg/x/starknet/mainnet',
}
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[NETWORK]

export const PRIVACY_POOL_ADDRESS =
  (process.env.NEXT_PUBLIC_PRIVACY_POOL_ADDRESS || '') as `0x${string}`

export const GENESIS_ADDRESS = '0x05acfbb98a9f8d2e177886fa02f5f329b254f6e333ab430ef53e25f4bbfbc8a3' as `0x${string}`
export const FEE_VAULT_ADDRESS = '0x0111beaef1d9b13378b0dbf1be40c556ccf6886591f6b1b29ed790fa13606471' as `0x${string}`
export const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' as `0x${string}`

/** SNIP-12 chain ID shortstrings - mirrors SDK's CHAIN_ID */
const CHAIN_IDS: Record<Network, string> = { sepolia: 'SN_SEPOLIA', mainnet: 'SN_MAIN' }
export const CHAIN_ID = CHAIN_IDS[NETWORK]

/** Block explorer transaction URL */
export const VOYAGER_TX_URL = NETWORK === 'mainnet'
  ? 'https://voyager.online/tx'
  : 'https://sepolia.voyager.online/tx'
