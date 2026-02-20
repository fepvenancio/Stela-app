import { db } from '../db/queries.js'
import { agreementIdToHex, fromU256, MAX_BPS } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleSigned(event: StarknetEvent) {
  const idLow = BigInt(event.data[0])
  const idHigh = BigInt(event.data[1])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const lender = event.data[2]
  const issuedPercentage = fromU256({
    low: BigInt(event.data[3]),
    high: BigInt(event.data[4]),
  })

  const status = issuedPercentage >= MAX_BPS ? 'filled' : 'partial'

  await db.upsertAgreement({
    id: agreementId,
    lender,
    status,
    issued_debt_percentage: issuedPercentage.toString(),
    signed_at: event.block.timestamp.toString(),
    updated_at_ts: event.block.timestamp.toString(),
  })

  await db.insertEvent({
    agreement_id: agreementId,
    event_type: 'signed',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
    data: { lender, issued_debt_percentage: issuedPercentage.toString() },
  })
}
