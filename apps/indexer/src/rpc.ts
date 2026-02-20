import { RpcProvider, Contract } from 'starknet'
import { STELA_ADDRESS, resolveNetwork } from '@stela/core'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const abi = require('@stela/core/abi/stela.json')

const network = resolveNetwork(process.env.NETWORK)
const rpcUrl = process.env.RPC_URL ?? 'https://starknet-sepolia.public.blastapi.io'

const provider = new RpcProvider({ nodeUrl: rpcUrl })
const contractAddress = process.env.STELA_ADDRESS ?? STELA_ADDRESS[network]

let contract: Contract | null = null

function getContract(): Contract {
  if (!contract) {
    contract = new Contract(abi, contractAddress, provider)
  }
  return contract
}

interface OnChainInscription {
  multi_lender: boolean
  duration: bigint
  deadline: bigint
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
}

/**
 * Fetch inscription details from the contract via RPC.
 * Used by handleCreated since the InscriptionCreated event
 * only emits inscription_id, creator, and is_borrow.
 */
export async function fetchInscriptionFromContract(
  inscriptionId: string
): Promise<OnChainInscription | null> {
  try {
    const c = getContract()
    const result = await c.call('get_inscription', [inscriptionId])

    // starknet.js decodes struct fields based on the ABI
    const r = result as Record<string, unknown>

    return {
      multi_lender: Boolean(r.multi_lender),
      duration: BigInt(r.duration as string | bigint),
      deadline: BigInt(r.deadline as string | bigint),
      debt_asset_count: Number(r.debt_asset_count),
      interest_asset_count: Number(r.interest_asset_count),
      collateral_asset_count: Number(r.collateral_asset_count),
    }
  } catch (err) {
    console.error(`Failed to fetch inscription ${inscriptionId} from contract:`, err)
    return null
  }
}
