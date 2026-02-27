import type { D1Queries, WebhookEvent } from '@stela/core'
import {
  createdDataSchema,
  signedDataSchema,
  cancelledDataSchema,
  repaidDataSchema,
  liquidatedDataSchema,
  redeemedDataSchema,
  transferSingleDataSchema,
  orderSettledDataSchema,
  privateSettledDataSchema,
  privateRedeemedDataSchema,
} from '../schemas.js'

export async function processWebhookEvent(event: WebhookEvent, queries: D1Queries): Promise<void> {
  switch (event.event_type) {
    case 'created':
      return handleCreated(event, queries)
    case 'signed':
      return handleSigned(event, queries)
    case 'cancelled':
      return handleCancelled(event, queries)
    case 'repaid':
      return handleRepaid(event, queries)
    case 'liquidated':
      return handleLiquidated(event, queries)
    case 'redeemed':
      return handleRedeemed(event, queries)
    case 'transfer_single':
      return handleTransferSingle(event, queries)
    case 'order_settled':
      return handleOrderSettled(event, queries)
    case 'private_settled':
      return handlePrivateSettled(event, queries)
    case 'private_redeemed':
      return handlePrivateRedeemed(event, queries)
    default:
      console.warn(`Unknown event type: ${event.event_type}`)
  }
}

async function handleCreated(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = createdDataSchema.parse(event.data)

  await queries.upsertInscription({
    id: d.inscription_id,
    creator: d.creator,
    status: d.status,
    issued_debt_percentage: 0,
    multi_lender: d.multi_lender,
    duration: d.duration,
    deadline: d.deadline,
    debt_asset_count: d.debt_asset_count,
    interest_asset_count: d.interest_asset_count,
    collateral_asset_count: d.collateral_asset_count,
    created_at_block: event.block_number,
    created_at_ts: event.timestamp,
    updated_at_ts: event.timestamp,
  })

  const roles = ['debt', 'interest', 'collateral'] as const
  for (const role of roles) {
    const assets = d.assets[role]
    for (let i = 0; i < assets.length; i++) {
      await queries.insertAsset({
        inscription_id: d.inscription_id,
        asset_role: role,
        asset_index: i,
        asset_address: assets[i].asset_address,
        asset_type: assets[i].asset_type,
        value: assets[i].value,
        token_id: assets[i].token_id,
      })
    }
  }

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'created',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
  })
}

async function handleSigned(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = signedDataSchema.parse(event.data)

  await queries.upsertInscription({
    id: d.inscription_id,
    borrower: d.borrower,
    lender: d.lender,
    status: d.status,
    issued_debt_percentage: d.issued_debt_percentage,
    signed_at: event.timestamp,
    updated_at_ts: event.timestamp,
  })

  if (d.locker_address) {
    await queries.upsertLocker(d.inscription_id, d.locker_address, event.timestamp)
  }

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'signed',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: {
      borrower: d.borrower,
      lender: d.lender,
      issued_debt_percentage: d.issued_debt_percentage,
    },
  })
}

async function handleCancelled(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = cancelledDataSchema.parse(event.data)

  await queries.updateInscriptionStatus(d.inscription_id, 'cancelled', event.timestamp)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'cancelled',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { creator: d.creator },
  })
}

async function handleRepaid(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = repaidDataSchema.parse(event.data)

  await queries.updateInscriptionStatus(d.inscription_id, 'repaid', event.timestamp)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'repaid',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { repayer: d.repayer },
  })
}

async function handleLiquidated(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = liquidatedDataSchema.parse(event.data)

  await queries.updateInscriptionStatus(d.inscription_id, 'liquidated', event.timestamp)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'liquidated',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { liquidator: d.liquidator },
  })
}

async function handleRedeemed(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = redeemedDataSchema.parse(event.data)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'redeemed',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { redeemer: d.redeemer, shares: d.shares },
  })
}

async function handleTransferSingle(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = transferSingleDataSchema.parse(event.data)

  // Insert dedup event first — if this tx was already processed, INSERT OR IGNORE
  // makes this a no-op and we skip the balance mutations to prevent double-counting
  const inserted = await queries.insertEventReturning({
    inscription_id: d.inscription_id,
    event_type: 'transfer_single',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: { from: d.from, to: d.to, value: d.value },
  })
  if (!inserted) return // Already processed — skip balance mutations

  if (BigInt(d.from) !== 0n) {
    await queries.decrementShareBalance(d.from, d.inscription_id, BigInt(d.value))
  }

  if (BigInt(d.to) !== 0n) {
    await queries.incrementShareBalance(d.to, d.inscription_id, BigInt(d.value))
  }
}

async function handleOrderSettled(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = orderSettledDataSchema.parse(event.data)

  // Update the off-chain order status to 'settled' (if it exists in D1)
  await queries.updateOrderStatus(d.order_id, 'settled')

  console.log(`OrderSettled: order=${d.order_id} borrower=${d.borrower} lender=${d.lender} tx=${event.tx_hash}`)
}

async function handlePrivateSettled(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = privateSettledDataSchema.parse(event.data)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'signed',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: {
      borrower: d.borrower,
      lender_commitment: d.lender_commitment,
      shares: d.shares,
      private: true,
    },
  })

  console.log(`PrivateSettled: inscription=${d.inscription_id} commitment=${d.lender_commitment} tx=${event.tx_hash}`)
}

async function handlePrivateRedeemed(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = privateRedeemedDataSchema.parse(event.data)

  await queries.insertEvent({
    inscription_id: d.inscription_id,
    event_type: 'redeemed',
    tx_hash: event.tx_hash,
    block_number: event.block_number,
    timestamp: event.timestamp,
    data: {
      nullifier: d.nullifier,
      recipient: d.recipient,
      shares: d.shares,
      private: true,
    },
  })

  console.log(`PrivateRedeemed: inscription=${d.inscription_id} nullifier=${d.nullifier} recipient=${d.recipient} tx=${event.tx_hash}`)
}
