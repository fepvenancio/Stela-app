import type { Inscription, AssetType } from '@fepvenancio/stela-sdk'
import { fromU256, ASSET_TYPE_NAMES } from '@fepvenancio/stela-sdk'

export function assetTypeFromEnum(val: number): AssetType {
  return ASSET_TYPE_NAMES[val] ?? 'ERC20'
}

// Parse raw contract response into typed Inscription
// Adjust field offsets based on actual ABI response structure
export function parseInscription(data: Record<string, unknown>): Inscription {
  const raw = data as Record<string, bigint | boolean | { low: bigint; high: bigint }>

  const id = typeof raw.id === 'object' && raw.id !== null && 'low' in raw.id
    ? fromU256(raw.id as { low: bigint; high: bigint })
    : BigInt(raw.id as bigint)

  const issuedPercentage = typeof raw.issued_debt_percentage === 'object' && raw.issued_debt_percentage !== null && 'low' in raw.issued_debt_percentage
    ? fromU256(raw.issued_debt_percentage as { low: bigint; high: bigint })
    : BigInt(raw.issued_debt_percentage as bigint)

  return {
    id: '0x' + id.toString(16).padStart(64, '0'),
    borrower: String(raw.borrower ?? '0x0'),
    lender: String(raw.lender ?? '0x0'),
    duration: BigInt(raw.duration as bigint),
    deadline: BigInt(raw.deadline as bigint),
    signed_at: BigInt(raw.signed_at as bigint),
    issued_debt_percentage: issuedPercentage,
    is_repaid: Boolean(raw.is_repaid),
    liquidated: Boolean(raw.liquidated),
    multi_lender: Boolean(raw.multi_lender),
    debt_asset_count: Number(raw.debt_asset_count),
    interest_asset_count: Number(raw.interest_asset_count),
    collateral_asset_count: Number(raw.collateral_asset_count),
    status: 'open', // will be recomputed by computeStatus
  }
}
