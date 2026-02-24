import { NextRequest } from 'next/server'
import { RpcProvider } from 'starknet'
import { InscriptionClient, parseEvents } from '@fepvenancio/stela-sdk'
import type { RawEvent, StelaEvent } from '@fepvenancio/stela-sdk'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit } from '@/lib/api'
import type { D1Queries } from '@stela/core'
import { CONTRACT_ADDRESS, RPC_URL } from '@/lib/config'
import { syncRequestSchema } from '@/lib/schemas'

const MAX_BPS = 10000n

function toIdHex(id: bigint): string {
  return '0x' + id.toString(16).padStart(64, '0')
}

function stripHex(addr: string): string {
  return addr.replace(/^0x0*/i, '').toLowerCase()
}

interface SyncAssetItem {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

interface SyncAssets {
  debt: SyncAssetItem[]
  interest: SyncAssetItem[]
  collateral: SyncAssetItem[]
}

interface ReceiptEvent {
  from_address: string
  keys: string[]
  data: string[]
}

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('invalid JSON', 400, request)
  }

  const parsed = syncRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('invalid request body', 400, request)
  }

  const { tx_hash, assets } = parsed.data
  const provider = new RpcProvider({ nodeUrl: RPC_URL })

  // Wait for transaction confirmation
  let receipt: Record<string, unknown>
  try {
    receipt = (await provider.waitForTransaction(tx_hash)) as unknown as Record<string, unknown>
  } catch {
    return errorResponse('transaction not found or pending', 404, request)
  }

  if (receipt.execution_status !== 'SUCCEEDED') {
    return errorResponse('transaction reverted', 422, request)
  }

  // Filter events to those emitted by the Stela contract
  const contractStripped = stripHex(CONTRACT_ADDRESS)
  const receiptEvents = (receipt.events ?? []) as ReceiptEvent[]
  const blockNumber = Number(receipt.block_number ?? 0)

  const rawEvents: RawEvent[] = receiptEvents
    .filter((e) => stripHex(e.from_address ?? '') === contractStripped)
    .map((e) => ({
      keys: e.keys,
      data: e.data,
      transaction_hash: tx_hash,
      block_number: blockNumber,
    }))

  if (rawEvents.length === 0) {
    return jsonResponse({ ok: true, events: 0 }, request)
  }

  const stelaEvents = parseEvents(rawEvents)
  const db = getD1()
  const client = new InscriptionClient({
    stelaAddress: CONTRACT_ADDRESS,
    provider,
  })
  const now = Math.floor(Date.now() / 1000)

  for (const event of stelaEvents) {
    try {
      await processEvent(event, db, client, now, blockNumber, tx_hash, assets as SyncAssets | undefined)
    } catch (err) {
      console.error(`Sync: failed to process ${event.type}:`, err)
    }
  }

  return jsonResponse({ ok: true, events: stelaEvents.length }, request)
}

// ---------------------------------------------------------------------------
// Event handlers — mirror workers/indexer/src/handlers/index.ts logic
// ---------------------------------------------------------------------------

async function processEvent(
  event: StelaEvent,
  db: D1Queries,
  client: InscriptionClient,
  now: number,
  blockNumber: number,
  txHash: string,
  assets?: SyncAssets,
) {
  switch (event.type) {
    case 'InscriptionCreated':
      return handleCreated(event, db, client, now, blockNumber, txHash, assets)
    case 'InscriptionSigned':
      return handleSigned(event, db, client, now, blockNumber, txHash)
    case 'InscriptionCancelled':
      return handleCancelled(event, db, now, blockNumber, txHash)
    case 'InscriptionRepaid':
      return handleRepaid(event, db, now, blockNumber, txHash)
    case 'InscriptionLiquidated':
      return handleLiquidated(event, db, now, blockNumber, txHash)
    case 'SharesRedeemed':
      return handleRedeemed(event, db, now, blockNumber, txHash)
    case 'TransferSingle':
      return handleTransferSingle(event, db, now, blockNumber, txHash)
  }
}

async function handleCreated(
  event: Extract<StelaEvent, { type: 'InscriptionCreated' }>,
  db: D1Queries,
  client: InscriptionClient,
  now: number,
  blockNumber: number,
  txHash: string,
  assets?: SyncAssets,
) {
  const idHex = toIdHex(event.inscription_id)

  // Fetch structural data from RPC for fields not in the event
  let rpcData: Awaited<ReturnType<typeof client.getInscription>> | null = null
  try {
    rpcData = await client.getInscription(event.inscription_id)
  } catch {
    // RPC unavailable — insert minimal record; indexer fills in later
  }

  await db.upsertInscription({
    id: idHex,
    creator: event.creator,
    status: 'open',
    issued_debt_percentage: 0,
    multi_lender: rpcData?.multi_lender ?? false,
    duration: rpcData ? Number(rpcData.duration) : 0,
    deadline: rpcData ? Number(rpcData.deadline) : 0,
    debt_asset_count: rpcData?.debt_asset_count ?? 0,
    interest_asset_count: rpcData?.interest_asset_count ?? 0,
    collateral_asset_count: rpcData?.collateral_asset_count ?? 0,
    created_at_block: blockNumber,
    created_at_ts: now,
    updated_at_ts: now,
  })

  // Insert assets from request body (INSERT OR IGNORE — safe for idempotency)
  if (assets) {
    const roles = ['debt', 'interest', 'collateral'] as const
    for (const role of roles) {
      const items = assets[role]
      for (let i = 0; i < items.length; i++) {
        await db.insertAsset({
          inscription_id: idHex,
          asset_role: role,
          asset_index: i,
          asset_address: items[i].asset_address,
          asset_type: items[i].asset_type,
          value: items[i].value,
          token_id: items[i].token_id ?? '0',
        })
      }
    }
  }

  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'created',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
  })
}

async function handleSigned(
  event: Extract<StelaEvent, { type: 'InscriptionSigned' }>,
  db: D1Queries,
  client: InscriptionClient,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.inscription_id)
  const status = event.issued_debt_percentage >= MAX_BPS ? 'filled' : 'partial'

  await db.upsertInscription({
    id: idHex,
    borrower: event.borrower,
    lender: event.lender,
    status,
    issued_debt_percentage: Number(event.issued_debt_percentage),
    signed_at: now,
    updated_at_ts: now,
  })

  // Fetch locker address from RPC
  try {
    const lockerAddress = await client.getLocker(event.inscription_id)
    if (lockerAddress) {
      await db.upsertLocker(idHex, lockerAddress, now)
    }
  } catch {
    // Locker not available — indexer will fill in later
  }

  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'signed',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: {
      borrower: event.borrower,
      lender: event.lender,
      issued_debt_percentage: Number(event.issued_debt_percentage),
    },
  })
}

async function handleCancelled(
  event: Extract<StelaEvent, { type: 'InscriptionCancelled' }>,
  db: D1Queries,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.inscription_id)
  await db.updateInscriptionStatus(idHex, 'cancelled', now)
  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'cancelled',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: { creator: event.creator },
  })
}

async function handleRepaid(
  event: Extract<StelaEvent, { type: 'InscriptionRepaid' }>,
  db: D1Queries,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.inscription_id)
  await db.updateInscriptionStatus(idHex, 'repaid', now)
  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'repaid',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: { repayer: event.repayer },
  })
}

async function handleLiquidated(
  event: Extract<StelaEvent, { type: 'InscriptionLiquidated' }>,
  db: D1Queries,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.inscription_id)
  await db.updateInscriptionStatus(idHex, 'liquidated', now)
  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'liquidated',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: { liquidator: event.liquidator },
  })
}

async function handleRedeemed(
  event: Extract<StelaEvent, { type: 'SharesRedeemed' }>,
  db: D1Queries,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.inscription_id)
  await db.insertEvent({
    inscription_id: idHex,
    event_type: 'redeemed',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: { redeemer: event.redeemer, shares: event.shares.toString() },
  })
}

async function handleTransferSingle(
  event: Extract<StelaEvent, { type: 'TransferSingle' }>,
  db: D1Queries,
  now: number,
  blockNumber: number,
  txHash: string,
) {
  const idHex = toIdHex(event.id)

  // Dedup: if this tx was already processed, INSERT OR IGNORE is a no-op
  const inserted = await db.insertEventReturning({
    inscription_id: idHex,
    event_type: 'transfer_single',
    tx_hash: txHash,
    block_number: blockNumber,
    timestamp: now,
    data: { from: event.from, to: event.to, value: event.value.toString() },
  })
  if (!inserted) return

  if (BigInt(event.from) !== 0n) {
    await db.decrementShareBalance(event.from, idHex, event.value)
  }
  if (BigInt(event.to) !== 0n) {
    await db.incrementShareBalance(event.to, idHex, event.value)
  }
}
