import { db } from '../db/queries.js'
import { agreementIdToHex } from '@stela/core'
import type { StarknetEvent } from '../types.js'
import { fetchAgreementFromContract } from '../rpc.js'

export async function handleCreated(event: StarknetEvent) {
  // ABI: agreement_id (key, u256), creator (key, felt), is_borrow (data, bool)
  // keys[0] = selector, keys[1..2] = id, keys[3] = creator
  const idLow = BigInt(event.keys[1])
  const idHigh = BigInt(event.keys[2])
  const agreementId = agreementIdToHex({ low: idLow, high: idHigh })

  const creator = event.keys[3]
  // data[0] = is_borrow (not stored in DB, but available)

  // The event only emits id, creator, and is_borrow.
  // Duration, deadline, multi_lender, and asset counts must be read from contract.
  const onChain = await fetchAgreementFromContract(agreementId)

  await db.upsertAgreement({
    id: agreementId,
    creator,
    status: 'open',
    issued_debt_percentage: 0,
    multi_lender: onChain?.multi_lender ?? false,
    duration: onChain?.duration?.toString() ?? '0',
    deadline: onChain?.deadline?.toString() ?? '0',
    debt_asset_count: onChain?.debt_asset_count ?? 0,
    interest_asset_count: onChain?.interest_asset_count ?? 0,
    collateral_asset_count: onChain?.collateral_asset_count ?? 0,
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
