import { db } from '../db/queries.js'
import { agreementIdToHex } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleCancelled(event: StarknetEvent) {
  // ABI: agreement_id (key, u256), creator (data, felt)
  // keys[0] = selector, keys[1..2] = id
  const idLow = BigInt(event.keys[1])
  const idHigh = BigInt(event.keys[2])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const creator = event.data[0]

  await db.updateAgreementStatus(agreementId, 'cancelled', event.block.timestamp)

  await db.insertEvent({
    agreement_id: agreementId,
    event_type: 'cancelled',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
    data: { creator },
  })
}
