import { db } from '../db/queries.js'
import { agreementIdToHex, MAX_BPS } from '@stela/core'

interface StarknetEvent {
  keys: string[]
  data: string[]
  transaction: { hash: string }
  block: { number: bigint; timestamp: bigint }
}

export async function handleSigned(event: StarknetEvent) {
  const idLow = BigInt(event.data[0])
  const idHigh = BigInt(event.data[1])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const lender = event.data[2]
  const percentageLow = BigInt(event.data[3])
  const percentageHigh = BigInt(event.data[4])
  const issuedPercentage = percentageLow + (percentageHigh << 128n)

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
