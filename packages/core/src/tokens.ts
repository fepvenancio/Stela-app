import type { Network } from './constants.js'

export interface TokenInfo {
  symbol: string
  name: string
  decimals: number
  addresses: Partial<Record<Network, string>>
}

/**
 * Curated StarkNet token list.
 * Addresses sourced from official deployments.
 */
export const TOKENS: TokenInfo[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    addresses: {
      sepolia: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      mainnet: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    },
  },
  {
    symbol: 'STRK',
    name: 'Starknet Token',
    decimals: 18,
    addresses: {
      sepolia: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
      mainnet: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    },
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      sepolia: '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080',
      mainnet: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
    },
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      sepolia: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158577e75e7777c',
      mainnet: '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
    },
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    addresses: {
      sepolia: '0x012d537dc323c439dc65c976fad242d5610d27cfb5f31689a0a319b8be7f3d56',
      mainnet: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
    },
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    addresses: {
      mainnet: '0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3',
    },
  },
  {
    symbol: 'wstETH',
    name: 'Wrapped stETH',
    decimals: 18,
    addresses: {
      sepolia: '0x0735d0f09a4e8bf8a17005fa35061b5957dcaa56889fc75df9ff7c0d36a4c5e0',
      mainnet: '0x042b8f0484674ca266ac5d08e4ac6a3fe65bd3129795def2dca5c34ecc5f96d2',
    },
  },
  // Mock tokens (Stela Sepolia testnet)
  {
    symbol: 'mUSDC',
    name: 'Mock USDC',
    decimals: 6,
    addresses: {
      sepolia: '0x034a0cf09c79e7f20fb2136212f27b7dd88e91f9a24b2ac50c5c41ff6b30c59d',
    },
  },
  {
    symbol: 'mWETH',
    name: 'Mock WETH',
    decimals: 18,
    addresses: {
      sepolia: '0x07e86764396d61d2179cd1a48033fa4f30897cb172464961a80649aff4da9bdd',
    },
  },
  {
    symbol: 'mDAI',
    name: 'Mock DAI',
    decimals: 18,
    addresses: {
      sepolia: '0x0479f31a23241b1337375b083099bd1672716edbf908b1b30148a648657a1cee',
    },
  },
  {
    symbol: 'StelaNFT',
    name: 'Stela NFT',
    decimals: 0,
    addresses: {
      sepolia: '0x04f2345306bf8ef1c8c1445661354ef08421aa092459445a5d6b46641237e943',
    },
  },
]

/** Get tokens available on a specific network */
export function getTokensForNetwork(network: Network): TokenInfo[] {
  return TOKENS.filter((t) => t.addresses[network] !== undefined)
}

/** Strip leading zeros after 0x for consistent comparison */
function normalizeHex(addr: string): string {
  return '0x' + addr.replace(/^0x0*/i, '').toLowerCase()
}

/** Find a token by its address (any network) */
export function findTokenByAddress(address: string): TokenInfo | undefined {
  const normalized = normalizeHex(address)
  return TOKENS.find((t) =>
    Object.values(t.addresses).some((a) => a !== undefined && normalizeHex(a) === normalized),
  )
}
