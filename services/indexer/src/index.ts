import { createClient } from '@apibara/protocol'
import { createIndexer, run, defineIndexer } from '@apibara/indexer'
import { StarknetStream } from '@apibara/starknet'
import { Metadata } from 'nice-grpc-common'
import { RpcProvider } from 'starknet'
import type { WebhookPayload, WebhookEvent } from '@stela/core'
import stelaAbi from '@stela/core/abi/stela.json' with { type: 'json' }
import { ALL_SELECTORS } from './rpc.js'
import { transformEvent } from './transform.js'
import type { RawStreamEvent, OrderWebhookEvent } from './transform.js'
import { postWebhook, postMatchingEngineWebhook } from './webhook.js'

// ---------------------------------------------------------------------------
// Order event types used for routing
// ---------------------------------------------------------------------------

const ORDER_EVENT_TYPES = new Set([
  'order_filled',
  'order_cancelled',
  'orders_bulk_cancelled',
])

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
const MATCHING_ENGINE_WEBHOOK_URL = process.env.MATCHING_ENGINE_WEBHOOK_URL

function requireHexAddress(name: string): `0x${string}` {
  const value = requireEnv(name)
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error(`Env var ${name} is not a valid hex address: ${value}`)
  }
  return value as `0x${string}`
}

if (!MATCHING_ENGINE_WEBHOOK_URL) {
  console.warn('MATCHING_ENGINE_WEBHOOK_URL not set — order events will not be forwarded to matching engine')
}

const DNA_STREAM_URL = 'https://sepolia.starknet.a5a.ch'

// ---------------------------------------------------------------------------
// Fetch last indexed block from CF Worker /health endpoint
// ---------------------------------------------------------------------------

async function fetchLastBlock(): Promise<number> {
  try {
    const res = await fetch(`${WEBHOOK_URL}/health`)
    if (!res.ok) {
      console.warn(`Health endpoint returned ${res.status}, starting from block 0`)
      return 0
    }
    const body = (await res.json()) as { last_block?: number }
    const lastBlock = body.last_block ?? 0
    console.log(`Last indexed block from worker: ${lastBlock}`)
    return lastBlock
  } catch (err) {
    console.warn('Failed to fetch last block from worker, starting from block 0:', err)
    return 0
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
      events: [
        {
          address: STELA_ADDRESS,
          keys: ALL_SELECTORS as `0x${string}`[],
          includeTransaction: true,
        },
      ],
    },
    async transform({ block }) {
      const header = block.header
      if (!header) return

      const blockNumber = Number(header.blockNumber)
      const timestamp = Number(header.timestamp)

      const events = block.events ?? []
      if (events.length === 0) return

      console.log(`Block ${blockNumber}: processing ${events.length} event(s)`)

      const inscriptionEvents: WebhookEvent[] = []
      const orderEvents: OrderWebhookEvent[] = []

      for (const streamEvent of events) {
        const rawEvent: RawStreamEvent = {
          keys: [...streamEvent.keys] as string[],
          data: [...streamEvent.data] as string[],
          transactionHash: streamEvent.transactionHash as string,
        }

        // If transaction is included, try to find calldata
        if (block.transactions) {
          for (const tx of block.transactions) {
            const txRecord = tx as Record<string, unknown>
            // Apibara includes transaction variants with calldata
            for (const variant of ['invokeV1', 'invokeV3', 'invokeV0'] as const) {
              const inner = txRecord[variant] as Record<string, unknown> | undefined
              if (inner?.calldata) {
                rawEvent.transaction = { calldata: inner.calldata as string[] }
                break
              }
            }
          }
        }

        const webhookEvent = await transformEvent(
          rawEvent,
          blockNumber,
          timestamp,
          provider,
          STELA_ADDRESS,
          stelaAbi as unknown[]
        )

        if (!webhookEvent) continue

        // Route based on event_type
        if (ORDER_EVENT_TYPES.has(webhookEvent.event_type)) {
          orderEvents.push(webhookEvent as OrderWebhookEvent)
        } else {
          inscriptionEvents.push(webhookEvent as WebhookEvent)
        }
      }

      // Inscription events → CF worker (unchanged behavior)
      if (inscriptionEvents.length > 0) {
        const payload: WebhookPayload = {
          block_number: blockNumber,
          events: inscriptionEvents,
          cursor: `${blockNumber}`,
        }

        console.log(`Posting ${inscriptionEvents.length} inscription event(s) from block ${blockNumber}`)
        await postWebhook(WEBHOOK_URL, WEBHOOK_SECRET, payload)
      }

      // Order events → matching engine
      if (orderEvents.length > 0 && MATCHING_ENGINE_WEBHOOK_URL) {
        console.log(`Posting ${orderEvents.length} order event(s) from block ${blockNumber} to matching engine`)
        await postMatchingEngineWebhook(MATCHING_ENGINE_WEBHOOK_URL, WEBHOOK_SECRET, { events: orderEvents })
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
  console.log(`Matching: ${MATCHING_ENGINE_WEBHOOK_URL ?? '(not configured)'}`)

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
