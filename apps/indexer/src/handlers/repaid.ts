import { db } from '../db/queries.js'
import { inscriptionIdToHex } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleRepaid(event: StarknetEvent) {
  // ABI: inscription_id (key, u256), repayer (data, felt)
  // keys[0] = selector, keys[1..2] = id
  const idLow = BigInt(event.keys[1])
  const idHigh = BigInt(event.keys[2])
  const inscriptionId = inscriptionIdToHex({ low: idLow, high: idHigh })

  const repayer = event.data[0]

  await db.updateInscriptionStatus(inscriptionId, 'repaid', event.block.timestamp)

  await db.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'repaid',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
    data: { repayer },
  })
}
