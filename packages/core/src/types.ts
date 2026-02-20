export type AssetType = 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626'

export type AgreementStatus =
  | 'open'
  | 'partial'
  | 'filled'
  | 'repaid'
  | 'liquidated'
  | 'expired'
  | 'cancelled'

export interface Asset {
  asset: string
  asset_type: AssetType
  value: bigint
  token_id: bigint
}

export interface Agreement {
  id: string
  borrower: string
  lender: string
  duration: bigint
  deadline: bigint
  signed_at: bigint
  issued_debt_percentage: bigint
  is_repaid: boolean
  liquidated: boolean
  multi_lender: boolean
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
  status: AgreementStatus
}

export interface AgreementEvent {
  agreement_id: string
  event_type: 'created' | 'signed' | 'cancelled' | 'repaid' | 'liquidated' | 'redeemed'
  tx_hash: string
  block_number: bigint
  timestamp: bigint
  data: Record<string, unknown>
}
