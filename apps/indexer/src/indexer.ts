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
  AgreementCreated: hash.getSelectorFromName('AgreementCreated'),
  AgreementSigned: hash.getSelectorFromName('AgreementSigned'),
  AgreementCancelled: hash.getSelectorFromName('AgreementCancelled'),
  AgreementRepaid: hash.getSelectorFromName('AgreementRepaid'),
  AgreementLiquidated: hash.getSelectorFromName('AgreementLiquidated'),
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
  [SELECTORS.AgreementCreated]: handleCreated,
  [SELECTORS.AgreementSigned]: handleSigned,
  [SELECTORS.AgreementCancelled]: handleCancelled,
  [SELECTORS.AgreementRepaid]: handleRepaid,
  [SELECTORS.AgreementLiquidated]: handleLiquidated,
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
