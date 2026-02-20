import { db } from '../db/queries.js'
import { agreementIdToHex, fromU256, MAX_BPS } from '@stela/core'
import type { StarknetEvent } from '../types.js'

export async function handleSigned(event: StarknetEvent) {
  // ABI: agreement_id (key, u256), borrower (key, felt), lender (key, felt),
  //      issued_debt_percentage (data, u256), shares_minted (data, u256)
  // keys[0] = selector, keys[1..2] = id, keys[3] = borrower, keys[4] = lender
  const idLow = BigInt(event.keys[1])
  const idHigh = BigInt(event.keys[2])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const borrower = event.keys[3]
  const lender = event.keys[4]

  // data[0..1] = issued_debt_percentage (u256), data[2..3] = shares_minted (u256)
  const issuedPercentage = fromU256({
    low: BigInt(event.data[0]),
    high: BigInt(event.data[1]),
  })

  const status = issuedPercentage >= MAX_BPS ? 'filled' : 'partial'

  await db.upsertAgreement({
    id: agreementId,
    borrower,
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
    data: { borrower, lender, issued_debt_percentage: issuedPercentage.toString() },
  })
}
