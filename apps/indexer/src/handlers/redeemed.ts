import { db } from '../db/queries.js'
import { inscriptionIdToHex, fromU256 } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleRedeemed(event: StarknetEvent) {
  // ABI: inscription_id (key, u256), redeemer (key, felt), shares (data, u256)
  // keys[0] = selector, keys[1..2] = id, keys[3] = redeemer
  const idLow = BigInt(event.keys[1])
  const idHigh = BigInt(event.keys[2])
  const inscriptionId = inscriptionIdToHex({ low: idLow, high: idHigh })

  const redeemer = event.keys[3]

  // data[0..1] = shares (u256)
  const shares = fromU256({
    low: BigInt(event.data[0]),
    high: BigInt(event.data[1]),
  })

  await db.insertEvent({
    inscription_id: inscriptionId,
    event_type: 'redeemed',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
    data: { redeemer, shares: shares.toString() },
  })
}
