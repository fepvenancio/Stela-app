import { createClient } from '@apibara/protocol'
import { createIndexer, run, defineIndexer } from '@apibara/indexer'
import { StarknetStream } from '@apibara/starknet'
import { Metadata } from 'nice-grpc-common'
import { RpcProvider } from 'starknet'
import type { WebhookPayload } from '@stela/core'
import stelaAbi from '@stela/core/abi/stela.json' with { type: 'json' }
import { ALL_SELECTORS } from './rpc.js'
import { transformEvent } from './transform.js'
import type { RawStreamEvent } from './transform.js'
import { postWebhook } from './webhook.js'

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const DNA_TOKEN = requireEnv('DNA_TOKEN')
const WEBHOOK_URL = requireEnv('WEBHOOK_URL')
const WEBHOOK_SECRET = requireEnv('WEBHOOK_SECRET')
const RPC_URL = requireEnv('RPC_URL')
const STELA_ADDRESS = requireHexAddress('STELA_ADDRESS')

function requireHexAddress(name: string): `0x${string}` {
  const value = requireEnv(name)
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error(`Env var ${name} is not a valid hex address: ${value}`)
  }
  return value as `0x${string}`
}

const DNA_STREAM_URL = requireEnv('DNA_STREAM_URL')

// Sensible default: skip blocks before the contract existed
const DEFAULT_START_BLOCK = Number(process.env.START_BLOCK || '7290000')

// ---------------------------------------------------------------------------
// Fetch last indexed block from CF Worker /health endpoint
// ---------------------------------------------------------------------------

async function fetchLastBlock(): Promise<number> {
  try {
    const res = await fetch(`${WEBHOOK_URL}/health`)
    if (!res.ok) {
      console.warn(`Health endpoint returned ${res.status}, using default start block ${DEFAULT_START_BLOCK}`)
      return DEFAULT_START_BLOCK
    }
    const body = (await res.json()) as { last_block?: number }
    const lastBlock = body.last_block ?? 0
    console.log(`Last indexed block from worker: ${lastBlock}`)
    // If worker reports 0 (empty DB), use sensible default instead of scanning from genesis
    if (lastBlock === 0) {
      console.log(`Worker returned 0, using default start block ${DEFAULT_START_BLOCK}`)
      return DEFAULT_START_BLOCK
    }
    return lastBlock
  } catch (err) {
    console.warn(`Failed to fetch last block from worker, using default start block ${DEFAULT_START_BLOCK}:`, err)
    return DEFAULT_START_BLOCK
  }
}

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = Infinity // Keep retrying forever
const INITIAL_BACKOFF_MS = 5_000 // 5 seconds
const MAX_BACKOFF_MS = 300_000 // 5 minutes

function backoff(attempt: number): number {
  return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
}

// ---------------------------------------------------------------------------
// Main — single run attempt
// ---------------------------------------------------------------------------

async function runOnce(): Promise<void> {
  const lastBlock = await fetchLastBlock()
  const startingBlock = lastBlock + 1
  console.log(`Starting from block ${startingBlock}`)

  const provider = new RpcProvider({ nodeUrl: RPC_URL })

  // Create gRPC client with auth token via metadata
  const client = createClient(StarknetStream, DNA_STREAM_URL, {
    defaultCallOptions: {
      '*': {
        metadata: Metadata({ authorization: `Bearer ${DNA_TOKEN}` }),
      },
    },
  })

  // Define and create the indexer
  const indexerDef = defineIndexer(StarknetStream)({
    streamUrl: DNA_STREAM_URL,
    startingBlock: BigInt(startingBlock),
    finality: 'accepted',
    filter: {
      events: ALL_SELECTORS.map((selector) => ({
        address: STELA_ADDRESS,
        keys: [selector as `0x${string}`],
        includeTransaction: true,
      })),
    },
    async transform({ block }) {
      const header = block.header
      if (!header) return

      const blockNumber = Number(header.blockNumber)
      const rawTs = header.timestamp
      const timestamp = rawTs instanceof Date
        ? Math.floor(rawTs.getTime() / 1000)
        : Number(rawTs)

      const events = block.events ?? []
      if (events.length === 0) return

      console.log(`Block ${blockNumber}: processing ${events.length} event(s)`)

      // Build txHash → calldata lookup map once per block
      const calldataByTxHash = new Map<string, string[]>()
      if (block.transactions) {
        for (const tx of block.transactions) {
          const txAny = tx as Record<string, unknown>
          const meta = txAny.meta as { transactionHash?: string } | undefined
          const txHash = meta?.transactionHash as string | undefined
          if (!txHash) continue

          // Apibara v2 uses a $case discriminated union for transaction variants
          const txBody = txAny.transaction as { $case?: string; [key: string]: unknown } | undefined
          if (!txBody) continue

          // Try $case pattern first (Apibara v2), then direct access (fallback)
          let calldata: string[] | undefined
          if (txBody.$case) {
            const inner = txBody[txBody.$case] as { calldata?: string[] } | undefined
            calldata = inner?.calldata as string[] | undefined
          } else {
            for (const variant of ['invokeV3', 'invokeV1', 'invokeV0'] as const) {
              const inner = txBody[variant] as { calldata?: string[] } | undefined
              if (inner?.calldata) {
                calldata = inner.calldata as string[]
                break
              }
            }
          }

          if (calldata) {
            calldataByTxHash.set(txHash, calldata)
          }
        }
      }

      const webhookEvents = []

      for (const streamEvent of events) {
        const rawEvent: RawStreamEvent = {
          keys: [...streamEvent.keys] as string[],
          data: [...streamEvent.data] as string[],
          transactionHash: streamEvent.transactionHash as string,
        }

        // Look up calldata for this event's transaction
        const calldata = calldataByTxHash.get(rawEvent.transactionHash)
        if (calldata) {
          rawEvent.transaction = { calldata }
        } else {
          console.warn(`No calldata found for tx ${rawEvent.transactionHash} (${calldataByTxHash.size} txs in block)`)
        }

        const webhookEvent = await transformEvent(
          rawEvent,
          blockNumber,
          timestamp,
          provider,
          STELA_ADDRESS,
          stelaAbi as unknown[]
        )

        if (webhookEvent) {
          webhookEvents.push(webhookEvent)
        }
      }

      if (webhookEvents.length > 0) {
        const payload: WebhookPayload = {
          block_number: blockNumber,
          events: webhookEvents,
          cursor: `${blockNumber}`,
        }

        console.log(`Posting ${webhookEvents.length} event(s) from block ${blockNumber}`)
        await postWebhook(WEBHOOK_URL, WEBHOOK_SECRET, payload)
      }
    },
  })

  const indexer = createIndexer(indexerDef)
  await run(client, indexer)
}

// ---------------------------------------------------------------------------
// Retry loop — reconnects automatically on stream failures
// ---------------------------------------------------------------------------

async function main() {
  console.log('Starting Stela Apibara indexer...')
  console.log(`Contract: ${STELA_ADDRESS}`)
  console.log(`Webhook:  ${WEBHOOK_URL}`)

  let attempt = 0

  while (true) {
    try {
      await runOnce()
      // run() resolved normally — stream ended cleanly, reconnect
      console.warn('Stream ended, reconnecting...')
      attempt = 0
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const delay = backoff(attempt)
      console.error(`Stream error (attempt ${attempt + 1}): ${msg}`)
      console.log(`Retrying in ${Math.round(delay / 1000)}s...`)
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
}

main().catch((err) => {
  console.error('Fatal indexer error:', err)
  process.exit(1)
})
