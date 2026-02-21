import { RpcProvider, Contract, hash } from 'starknet'
import { toU256 } from '@stela/core'
import stelaAbi from '@stela/core/abi/stela.json'
import type { Env } from './types.js'
import type { RpcEvent, GetEventsResult, OnChainInscription } from './types.js'

/** All event selectors the indexer listens for */
export const SELECTORS = {
  InscriptionCreated: hash.getSelectorFromName('InscriptionCreated'),
  InscriptionSigned: hash.getSelectorFromName('InscriptionSigned'),
  InscriptionCancelled: hash.getSelectorFromName('InscriptionCancelled'),
  InscriptionRepaid: hash.getSelectorFromName('InscriptionRepaid'),
  InscriptionLiquidated: hash.getSelectorFromName('InscriptionLiquidated'),
  SharesRedeemed: hash.getSelectorFromName('SharesRedeemed'),
  TransferSingle: hash.getSelectorFromName('TransferSingle'),
} as const

const ALL_SELECTORS = Object.values(SELECTORS)

/** Fetch all events in a block range with pagination */
export async function fetchAllEvents(
  provider: RpcProvider,
  stelaAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<RpcEvent[]> {
  const allEvents: RpcEvent[] = []
  let continuationToken: string | undefined

  do {
    const params: {
      from_block: { block_number: number }
      to_block: { block_number: number }
      address: string
      keys: string[][]
      chunk_size: number
      continuation_token?: string
    } = {
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      address: stelaAddress,
      keys: [ALL_SELECTORS],
      chunk_size: 100,
    }

    if (continuationToken) {
      params.continuation_token = continuationToken
    }

    const result = (await provider.getEvents(params)) as unknown as GetEventsResult
    allEvents.push(...result.events)
    continuationToken = result.continuation_token
  } while (continuationToken)

  return allEvents
}

/** Get block timestamp via RPC (cached per run) */
export async function getBlockTimestamp(
  provider: RpcProvider,
  blockNumber: number,
  cache: Map<number, number>
): Promise<number> {
  const cached = cache.get(blockNumber)
  if (cached !== undefined) return cached

  try {
    const block = await provider.getBlockWithTxHashes(blockNumber)
    const ts = block.timestamp
    cache.set(blockNumber, ts)
    return ts
  } catch {
    return 0
  }
}

/** Fetch the locker TBA address for a given inscription from the contract */
export async function fetchLockerAddress(env: Env, inscriptionId: string): Promise<string | null> {
  const provider = new RpcProvider({ nodeUrl: env.RPC_URL })
  try {
    const contract = new Contract(stelaAbi, env.STELA_ADDRESS, provider)
    const result = await contract.call('get_locker', toU256(BigInt(inscriptionId)))
    const addr = (result as unknown[])[0] as string | bigint | undefined
    return addr && BigInt(addr) !== 0n ? String(addr) : null
  } catch {
    return null
  }
}

/** Fetch inscription data directly from the StarkNet contract */
export async function fetchInscriptionFromContract(
  provider: RpcProvider,
  stelaAddress: string,
  inscriptionId: string
): Promise<OnChainInscription | null> {
  try {
    const contract = new Contract(stelaAbi, stelaAddress, provider)
    const result = await contract.call('get_inscription', [inscriptionId])
    const r = result as Record<string, unknown>

    return {
      multi_lender: Boolean(r.multi_lender),
      duration: Number(BigInt(r.duration as string | bigint)),
      deadline: Number(BigInt(r.deadline as string | bigint)),
      debt_asset_count: Number(r.debt_asset_count),
      interest_asset_count: Number(r.interest_asset_count),
      collateral_asset_count: Number(r.collateral_asset_count),
    }
  } catch (err) {
    console.error(`Failed to fetch inscription ${inscriptionId} from contract:`, err)
    return null
  }
}
