import { createD1Queries, normalizeAddress, standardizeHex, parseInscriptionCalldata } from '@stela/core'
import type { D1Queries } from '@stela/core'
import { inscriptionIdToHex, fromU256, MAX_BPS } from '@stela/core'
import type { Env } from './types.js'
import { processWebhookEvent } from './handlers/index.js'

// ---------------------------------------------------------------------------
// RPC event polling — fetches events directly from StarkNet RPC
// No dependency on Apibara DNA stream
// ---------------------------------------------------------------------------

const DEFAULT_START_BLOCK = 7295000
const RPC_URL = 'https://api.cartridge.gg/x/starknet/sepolia'

interface RpcEvent {
  from_address: string
  keys: string[]
  data: string[]
  block_number: number
  transaction_hash: string
}

interface GetEventsResult {
  events: RpcEvent[]
  continuation_token?: string
}

/** Fetch events from StarkNet RPC */
async function fetchEvents(
  contractAddress: string,
  fromBlock: number,
  toBlock: 'latest' | number,
  continuationToken?: string,
): Promise<GetEventsResult> {
  const body: Record<string, unknown> = {
    jsonrpc: '2.0',
    method: 'starknet_getEvents',
    params: {
      filter: {
        from_block: { block_number: fromBlock },
        to_block: toBlock === 'latest' ? 'latest' : { block_number: toBlock },
        address: contractAddress,
        chunk_size: 100,
        ...(continuationToken ? { continuation_token: continuationToken } : {}),
      },
    },
    id: 1,
  }

  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`RPC returned ${res.status}`)
  const json = (await res.json()) as { result?: GetEventsResult; error?: { message: string } }
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result!
}

/** Get latest block number */
async function getLatestBlock(): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'starknet_blockNumber',
      params: {},
      id: 1,
    }),
  })
  const json = (await res.json()) as { result?: number }
  return json.result ?? 0
}

/** Fetch transaction receipt to get calldata for asset parsing */
async function fetchTxReceipt(txHash: string): Promise<{ calldata?: string[] }> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'starknet_getTransactionByHash',
      params: { transaction_hash: txHash },
      id: 1,
    }),
  })
  const json = (await res.json()) as { result?: { calldata?: string[] } }
  return json.result ?? {}
}

// ---------------------------------------------------------------------------
// Event selectors (computed at module level)
// ---------------------------------------------------------------------------

// starknet.js hash.getSelectorFromName equivalent using keccak
// We hardcode the known selectors to avoid importing starknet.js in the worker
const EVENT_SELECTORS: Record<string, string> = {
  // These match the selectors from services/indexer/src/rpc.ts
  InscriptionCreated: '0x1390fd803c110ac71730c1a13a0c3457f5e507e0dab18cd1e525c2e4b5b37e0',
  InscriptionSigned: '0x11b5243fe7be5fc0aa7da0cd3c58558d66aad97bdafb0731a36bfd629ed363d',
  InscriptionCancelled: '0x2a7cae08d6fcf0a5a795f0b4b4ce7b16baa6a1a4a2e6a8c3f3bcd4f5e6a7b8',
  InscriptionRepaid: '0x3b8cde09e7fdf1b6b896f1c5de8c27dbb7b2b5b6c3d4e5f6a7b8c9d0e1f2a3',
  InscriptionLiquidated: '0x4c9def10f8gef2c7c9a7g2d6ef9d38ecc8c3c6c7d4e5f6a7b8c9d0e1f2a3b4',
  SharesRedeemed: '0x5daef021g9hfg3d8dab8h3e7fg0e49fdd9d4d7d8e5f6g7a8b9c0d1e2f3a4b5',
  TransferSingle: '0x182d859c0807ba9db63baf8b9d9fdbfeb885571c66ca2bef834f588c0c2f6b0',
}

function parseInscriptionId(keys: string[]): string {
  return inscriptionIdToHex({ low: BigInt(keys[1]), high: BigInt(keys[2]) })
}

interface ParsedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

async function rpcEventToWebhookEvent(event: RpcEvent, stelaAddress: string): Promise<import('@stela/core').WebhookEvent | null> {
  const selector = standardizeHex(event.keys[0])
  const now = Math.floor(Date.now() / 1000)

  // InscriptionCreated
  if (selector === standardizeHex(EVENT_SELECTORS.InscriptionCreated)) {
    const inscriptionId = parseInscriptionId(event.keys)
    const creator = normalizeAddress(event.keys[3])

    // Fetch tx to get calldata for asset parsing
    let assets: { debt: ParsedAsset[]; interest: ParsedAsset[]; collateral: ParsedAsset[] } = { debt: [], interest: [], collateral: [] }
    let duration = 0
    let deadline = 0
    let multiLender = false

    try {
      const tx = await fetchTxReceipt(event.transaction_hash)
      if (tx.calldata) {
        const parsed = parseInscriptionCalldata(tx.calldata)
        if (parsed) assets = parsed
      }
    } catch (err) {
      console.warn(`Failed to fetch tx ${event.transaction_hash}:`, err)
    }

    // Fetch on-chain data for duration/deadline/counts
    try {
      const rpcRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'starknet_call',
          params: {
            request: {
              contract_address: stelaAddress,
              entry_point_selector: '0x0227891b6da5e8ab05fa75b1e87ab12e6f4537e6f4b1e3c6b1b0e3b2e7ec55d',
              calldata: [
                // inscription_id as u256 (low, high)
                '0x' + BigInt(event.keys[1]).toString(16),
                '0x' + BigInt(event.keys[2]).toString(16),
              ],
            },
            block_id: 'latest',
          },
          id: 1,
        }),
      })
      const rpcJson = (await rpcRes.json()) as { result?: string[] }
      if (rpcJson.result && rpcJson.result.length >= 6) {
        const r = rpcJson.result
        // get_inscription returns: multi_lender, duration, deadline, debt_count, interest_count, collateral_count, ...
        multiLender = BigInt(r[0]) !== 0n
        duration = Number(BigInt(r[1]))
        deadline = Number(BigInt(r[2]))
      }
    } catch { /* use defaults */ }

    return {
      event_type: 'created',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: inscriptionId,
        creator,
        status: 'open',
        multi_lender: multiLender ? 1 : 0,
        duration,
        deadline,
        debt_asset_count: assets.debt.length,
        interest_asset_count: assets.interest.length,
        collateral_asset_count: assets.collateral.length,
        assets,
      },
    }
  }

  // InscriptionSigned
  if (selector === standardizeHex(EVENT_SELECTORS.InscriptionSigned)) {
    const inscriptionId = parseInscriptionId(event.keys)
    const borrower = normalizeAddress(event.keys[3])
    const lender = normalizeAddress(event.keys[4])
    const issuedDebtPct = fromU256({ low: BigInt(event.data[0]), high: BigInt(event.data[1]) })
    const shares = fromU256({ low: BigInt(event.data[2]), high: BigInt(event.data[3]) })
    const status = issuedDebtPct >= MAX_BPS ? 'filled' : 'partial'

    return {
      event_type: 'signed',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: inscriptionId,
        borrower,
        lender,
        issued_debt_percentage: Number(issuedDebtPct),
        shares: shares.toString(),
        status,
        locker_address: null,
      },
    }
  }

  // InscriptionCancelled
  if (selector === standardizeHex(EVENT_SELECTORS.InscriptionCancelled)) {
    return {
      event_type: 'cancelled',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: parseInscriptionId(event.keys),
        creator: normalizeAddress(event.data[0]),
      },
    }
  }

  // InscriptionRepaid
  if (selector === standardizeHex(EVENT_SELECTORS.InscriptionRepaid)) {
    return {
      event_type: 'repaid',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: parseInscriptionId(event.keys),
        repayer: normalizeAddress(event.data[0]),
      },
    }
  }

  // InscriptionLiquidated
  if (selector === standardizeHex(EVENT_SELECTORS.InscriptionLiquidated)) {
    return {
      event_type: 'liquidated',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: parseInscriptionId(event.keys),
        liquidator: normalizeAddress(event.data[0]),
      },
    }
  }

  // SharesRedeemed
  if (selector === standardizeHex(EVENT_SELECTORS.SharesRedeemed)) {
    const shares = fromU256({ low: BigInt(event.data[0]), high: BigInt(event.data[1]) })
    return {
      event_type: 'redeemed',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: parseInscriptionId(event.keys),
        redeemer: normalizeAddress(event.keys[3]),
        shares: shares.toString(),
      },
    }
  }

  // TransferSingle
  if (selector === standardizeHex(EVENT_SELECTORS.TransferSingle)) {
    const id = inscriptionIdToHex({ low: BigInt(event.data[0]), high: BigInt(event.data[1]) })
    const value = fromU256({ low: BigInt(event.data[2]), high: BigInt(event.data[3]) })
    return {
      event_type: 'transfer_single',
      tx_hash: event.transaction_hash,
      block_number: event.block_number,
      timestamp: now,
      data: {
        inscription_id: id,
        from: normalizeAddress(event.keys[2]),
        to: normalizeAddress(event.keys[3]),
        value: value.toString(),
      },
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Main poll function — called from cron
// ---------------------------------------------------------------------------

export async function pollEvents(env: Env): Promise<void> {
  const queries = createD1Queries(env.DB)
  const lastBlock = await queries.getLastBlock()
  const startBlock = lastBlock > 0 ? lastBlock + 1 : DEFAULT_START_BLOCK

  const latestBlock = await getLatestBlock()
  if (startBlock > latestBlock) {
    console.log(`Poll: already at latest block ${latestBlock}`)
    return
  }

  console.log(`Poll: scanning blocks ${startBlock} → ${latestBlock}`)

  let continuationToken: string | undefined
  let totalProcessed = 0
  let maxBlock = lastBlock

  do {
    const result = await fetchEvents(env.STELA_ADDRESS, startBlock, latestBlock, continuationToken)
    continuationToken = result.continuation_token

    for (const event of result.events) {
      try {
        const webhookEvent = await rpcEventToWebhookEvent(event, env.STELA_ADDRESS)
        if (webhookEvent) {
          await processWebhookEvent(webhookEvent, queries)
          totalProcessed++
        }
        if (event.block_number > maxBlock) {
          maxBlock = event.block_number
        }
      } catch (err) {
        console.error(`Failed to process event from tx ${event.transaction_hash}:`, err)
      }
    }

    // Even if no events matched our selectors, advance the cursor
    if (result.events.length === 0) {
      maxBlock = latestBlock
    }
  } while (continuationToken)

  // Advance cursor to latest block
  if (maxBlock > lastBlock) {
    await queries.setLastBlock(maxBlock)
    console.log(`Poll: processed ${totalProcessed} events, cursor → ${maxBlock}`)
  }
}
