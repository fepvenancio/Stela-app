import { STELA_ADDRESS, resolveNetwork } from '@stela/core'
import { hash } from 'starknet'
import type { StarknetEvent } from './types.js'
import { handleCreated } from './handlers/created.js'
import { handleSigned } from './handlers/signed.js'
import { handleRepaid } from './handlers/repaid.js'
import { handleLiquidated } from './handlers/liquidated.js'
import { handleRedeemed } from './handlers/redeemed.js'
import { handleCancelled } from './handlers/cancelled.js'

const SELECTORS = {
  InscriptionCreated: hash.getSelectorFromName('InscriptionCreated'),
  InscriptionSigned: hash.getSelectorFromName('InscriptionSigned'),
  InscriptionCancelled: hash.getSelectorFromName('InscriptionCancelled'),
  InscriptionRepaid: hash.getSelectorFromName('InscriptionRepaid'),
  InscriptionLiquidated: hash.getSelectorFromName('InscriptionLiquidated'),
  SharesRedeemed: hash.getSelectorFromName('SharesRedeemed'),
} as const

const network = resolveNetwork(process.env.NETWORK)

// Apibara indexer configuration
// Requires @apibara/indexer and @apibara/starknet to be properly configured
// Run with: pnpm --filter indexer index

export const config = {
  streamUrl: process.env.APIBARA_STREAM_URL,
  startingBlock: Number(process.env.START_BLOCK ?? 0),
  filter: {
    events: [
      {
        address: STELA_ADDRESS[network],
        keys: Object.values(SELECTORS).map((s) => [s]),
      },
    ],
  },
}

type Handler = (event: StarknetEvent) => Promise<void>

const HANDLER_MAP: Record<string, Handler> = {
  [SELECTORS.InscriptionCreated]: handleCreated,
  [SELECTORS.InscriptionSigned]: handleSigned,
  [SELECTORS.InscriptionCancelled]: handleCancelled,
  [SELECTORS.InscriptionRepaid]: handleRepaid,
  [SELECTORS.InscriptionLiquidated]: handleLiquidated,
  [SELECTORS.SharesRedeemed]: handleRedeemed,
}

export async function transform(events: StarknetEvent[]) {
  for (const event of events) {
    const handler = HANDLER_MAP[event.keys[0]]
    if (!handler) continue
    try {
      await handler(event)
    } catch (err) {
      console.error(`Error handling event ${event.keys[0]} in tx ${event.transaction.hash}:`, err)
    }
  }
}
