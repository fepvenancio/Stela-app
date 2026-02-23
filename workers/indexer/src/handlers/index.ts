import type { D1Queries, WebhookEvent } from '@stela/core'

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
  }
}

async function handleCreated(event: WebhookEvent, queries: D1Queries): Promise<void> {
  const d = event.data as {
    inscription_id: string
    creator: string
    status: 'open'
    multi_lender: number
    duration: number
    deadline: number
    debt_asset_count: number
    interest_asset_count: number
    collateral_asset_count: number
    assets: {
      debt: { asset_address: string; asset_type: string; value: string; token_id: string }[]
      interest: { asset_address: string; asset_type: string; value: string; token_id: string }[]
      collateral: { asset_address: string; asset_type: string; value: string; token_id: string }[]
    }
  }

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
  const d = event.data as {
    inscription_id: string
    borrower: string
    lender: string
    status: 'filled' | 'partial'
    issued_debt_percentage: number
    locker_address: string | null
  }

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
  const d = event.data as { inscription_id: string; creator: string }

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
  const d = event.data as { inscription_id: string; repayer: string }

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
  const d = event.data as { inscription_id: string; liquidator: string }

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
  const d = event.data as { inscription_id: string; redeemer: string; shares: string }

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
  const d = event.data as {
    inscription_id: string
    from: string
    to: string
    value: string
  }

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
