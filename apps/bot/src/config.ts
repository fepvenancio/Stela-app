import type { Network } from '@stela/core'
import { STELA_ADDRESS } from '@stela/core'

const REQUIRED_ENV = ['DATABASE_URL', 'RPC_URL', 'BOT_ADDRESS', 'BOT_PRIVATE_KEY'] as const

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

export const NETWORK: Network = (process.env.NETWORK as Network) ?? 'sepolia'
export const CONTRACT_ADDRESS = STELA_ADDRESS[NETWORK]
export const RPC_URL = process.env.RPC_URL!
export const BOT_ADDRESS = process.env.BOT_ADDRESS!
export const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY!
export const DATABASE_URL = process.env.DATABASE_URL!
export const TX_TIMEOUT_MS = 120_000
