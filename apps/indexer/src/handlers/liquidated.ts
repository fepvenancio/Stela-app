import { db } from '../db/queries.js'
import { agreementIdToHex } from '@stela/core'

interface StarknetEvent {
  keys: string[]
  data: string[]
  transaction: { hash: string }
  block: { number: bigint; timestamp: bigint }
}

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
