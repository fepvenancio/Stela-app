import { db } from '../db/queries.js'
import { agreementIdToHex } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleLiquidated(event: StarknetEvent) {
  const idLow = BigInt(event.data[0])
  const idHigh = BigInt(event.data[1])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  await db.updateAgreementStatus(agreementId, 'liquidated', event.block.timestamp)

  await db.insertEvent({
    agreement_id: agreementId,
    event_type: 'liquidated',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
  })
}
