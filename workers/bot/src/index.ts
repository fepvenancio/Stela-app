import { Account, RpcProvider } from 'starknet'
import { createD1Queries, toU256 } from '@stela/core'
import type { D1Database } from '@stela/core'

interface Env {
  DB: D1Database
  STELA_ADDRESS: string
  RPC_URL: string
  BOT_ADDRESS: string
  BOT_PRIVATE_KEY: string
}

const TX_TIMEOUT_MS = 120_000

async function liquidate(
  account: Account,
  provider: RpcProvider,
  contractAddress: string,
  inscriptionId: string,
): Promise<string> {
  const { transaction_hash } = await account.execute({
    contractAddress,
    entrypoint: 'liquidate',
    calldata: [...toU256(BigInt(inscriptionId))],
  })

  await withTimeout(provider.waitForTransaction(transaction_hash), TX_TIMEOUT_MS)
  return transaction_hash
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Transaction timed out after ${ms}ms`)), ms),
    ),
  ])
}

export default {
  async fetch(): Promise<Response> {
    return new Response('stela-bot', { status: 200 })
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    console.log(`[${new Date().toISOString()}] Checking for liquidatable inscriptions...`)

    const queries = createD1Queries(env.DB)
    const candidates = await queries.findLiquidatable(now)

    if (candidates.length === 0) {
      console.log('No liquidatable inscriptions found')
      return
    }

    console.log(`Found ${candidates.length} candidate(s)`)

    const provider = new RpcProvider({ nodeUrl: env.RPC_URL })
    const account = new Account(provider, env.BOT_ADDRESS, env.BOT_PRIVATE_KEY)

    // Serialize liquidations to avoid StarkNet nonce conflicts
    const work = async () => {
      for (const inscription of candidates) {
        try {
          const txHash = await liquidate(account, provider, env.STELA_ADDRESS, inscription.id)
          console.log(`Liquidated ${inscription.id}: ${txHash}`)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`Failed to liquidate ${inscription.id}: ${message}`)
        }
      }
    }

    ctx.waitUntil(work())
  },
} satisfies ExportedHandler<Env>
