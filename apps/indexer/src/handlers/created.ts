import { db } from '../db/queries.js'
import { agreementIdToHex } from '@stela/core'

interface StarknetEvent {
  keys: string[]
  data: string[]
  transaction: { hash: string }
  block: { number: bigint; timestamp: bigint }
}

export async function handleCreated(event: StarknetEvent) {
  const idLow = BigInt(event.data[0])
  const idHigh = BigInt(event.data[1])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const creator = event.data[2]
  const multiLender = BigInt(event.data[3]) !== 0n
  const duration = BigInt(event.data[4])
  const deadline = BigInt(event.data[5])
  const debtCount = Number(event.data[6])
  const interestCount = Number(event.data[7])
  const collateralCount = Number(event.data[8])

  await db.upsertAgreement({
    id: agreementId,
    creator,
    status: 'open',
    issued_debt_percentage: 0,
    multi_lender: multiLender,
    duration: duration.toString(),
    deadline: deadline.toString(),
    debt_asset_count: debtCount,
    interest_asset_count: interestCount,
    collateral_asset_count: collateralCount,
    created_at_block: event.block.number.toString(),
    created_at_ts: event.block.timestamp.toString(),
    updated_at_ts: event.block.timestamp.toString(),
  })

  await db.insertEvent({
    agreement_id: agreementId,
    event_type: 'created',
    tx_hash: event.transaction.hash,
    block_number: event.block.number,
    timestamp: event.block.timestamp,
  })
}
