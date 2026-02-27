import { RpcProvider, Contract, hash } from 'starknet'
import { toU256 } from '@stela/core'

/** All event selectors the indexer listens for */
export const SELECTORS = {
  InscriptionCreated: hash.getSelectorFromName('InscriptionCreated'),
  InscriptionSigned: hash.getSelectorFromName('InscriptionSigned'),
  InscriptionCancelled: hash.getSelectorFromName('InscriptionCancelled'),
  InscriptionRepaid: hash.getSelectorFromName('InscriptionRepaid'),
  InscriptionLiquidated: hash.getSelectorFromName('InscriptionLiquidated'),
  SharesRedeemed: hash.getSelectorFromName('SharesRedeemed'),
  TransferSingle: hash.getSelectorFromName('TransferSingle'),
  PrivateSettled: hash.getSelectorFromName('PrivateSettled'),
  PrivateSharesRedeemed: hash.getSelectorFromName('PrivateSharesRedeemed'),
} as const

export const ALL_SELECTORS = Object.values(SELECTORS)

export interface OnChainInscription {
  multi_lender: boolean
  duration: number
  deadline: number
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
}

export interface ParsedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

/** Fetch inscription data directly from the StarkNet contract */
export async function fetchInscriptionFromContract(
  provider: RpcProvider,
  stelaAddress: string,
  abi: unknown[],
  inscriptionId: string
): Promise<OnChainInscription | null> {
  try {
    const contract = new Contract(abi, stelaAddress, provider)
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

/** Fetch the locker TBA address for a given inscription from the contract */
export async function fetchLockerAddress(
  provider: RpcProvider,
  stelaAddress: string,
  abi: unknown[],
  inscriptionId: string
): Promise<string | null> {
  try {
    const contract = new Contract(abi, stelaAddress, provider)
    const result = await contract.call('get_locker', toU256(BigInt(inscriptionId)))
    const addr = (result as unknown[])[0] as string | bigint | undefined
    return addr && BigInt(addr) !== 0n ? String(addr) : null
  } catch {
    return null
  }
}
