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

export const GENESIS_ADDRESS = '0x02405de15c17aaf863bcf23c22706d73d142c8a81df29de9ef129666655847ca' as `0x${string}`
export const FEE_VAULT_ADDRESS = '0x065f7103f01474dcc860d200e9e8eb7c467dbe3f6dcf0af5b84cfa143fb264f6' as `0x${string}`
export const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' as `0x${string}`

/** SNIP-12 chain ID shortstrings - mirrors SDK's CHAIN_ID */
const CHAIN_IDS: Record<Network, string> = { sepolia: 'SN_SEPOLIA', mainnet: 'SN_MAIN' }
export const CHAIN_ID = CHAIN_IDS[NETWORK]

/** Block explorer transaction URL */
export const VOYAGER_TX_URL = NETWORK === 'mainnet'
  ? 'https://voyager.online/tx'
  : 'https://sepolia.voyager.online/tx'
