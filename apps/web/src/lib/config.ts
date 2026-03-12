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

export const GENESIS_ADDRESS = '0x0265ea52ffbf1b7e1a029b94fe1a2023899dd0bc02eb1f11c9b04ea90e957d28' as `0x${string}`
export const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' as `0x${string}`

/** SNIP-12 chain ID shortstrings - mirrors SDK's CHAIN_ID */
const CHAIN_IDS: Record<Network, string> = { sepolia: 'SN_SEPOLIA', mainnet: 'SN_MAIN' }
export const CHAIN_ID = CHAIN_IDS[NETWORK]

/** Block explorer transaction URL */
export const VOYAGER_TX_URL = NETWORK === 'mainnet'
  ? 'https://voyager.online/tx'
  : 'https://sepolia.voyager.online/tx'

/** Alchemy NFT API base URL (per network) */
export const ALCHEMY_NFT_BASE = NETWORK === 'mainnet'
  ? 'https://starknet-mainnet.g.alchemy.com/nft/v3'
  : 'https://starknet-sepolia.g.alchemy.com/nft/v3'
