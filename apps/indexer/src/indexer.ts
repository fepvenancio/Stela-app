import { STELA_ADDRESS } from '@stela/core'
import { hash } from 'starknet'
import { handleCreated } from './handlers/created.js'
import { handleSigned } from './handlers/signed.js'
import { handleRepaid } from './handlers/repaid.js'
import { handleLiquidated } from './handlers/liquidated.js'
import { handleRedeemed } from './handlers/redeemed.js'

const SELECTORS = {
  AgreementCreated: hash.getSelectorFromName('AgreementCreated'),
  AgreementSigned: hash.getSelectorFromName('AgreementSigned'),
  AgreementCancelled: hash.getSelectorFromName('AgreementCancelled'),
  AgreementRepaid: hash.getSelectorFromName('AgreementRepaid'),
  AgreementLiquidated: hash.getSelectorFromName('AgreementLiquidated'),
  SharesRedeemed: hash.getSelectorFromName('SharesRedeemed'),
} as const

interface StarknetEvent {
  keys: string[]
  data: string[]
  transaction: { hash: string }
  block: { number: bigint; timestamp: bigint }
}

// Apibara indexer configuration
// Requires @apibara/indexer and @apibara/starknet to be properly configured
// Run with: pnpm --filter indexer index

export const config = {
  streamUrl: process.env.APIBARA_STREAM_URL,
  startingBlock: Number(process.env.START_BLOCK ?? 0),
  filter: {
    events: [
      {
        address: STELA_ADDRESS.sepolia,
        keys: Object.values(SELECTORS).map((s) => [s]),
      },
    ],
  },
}

export async function transform(events: StarknetEvent[]) {
  for (const event of events) {
    const selector = event.keys[0]
    switch (selector) {
      case SELECTORS.AgreementCreated:
        await handleCreated(event)
        break
      case SELECTORS.AgreementSigned:
        await handleSigned(event)
        break
      case SELECTORS.AgreementRepaid:
        await handleRepaid(event)
        break
      case SELECTORS.AgreementLiquidated:
        await handleLiquidated(event)
        break
      case SELECTORS.SharesRedeemed:
        await handleRedeemed(event)
        break
    }
  }
}
