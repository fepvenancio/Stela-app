export type AssetType = 'ERC20' | 'ERC721' | 'ERC1155' | 'ERC4626'

export type InscriptionStatus =
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

export interface Inscription {
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
  status: InscriptionStatus
}

export interface InscriptionEvent {
  inscription_id: string
  event_type: 'created' | 'signed' | 'cancelled' | 'repaid' | 'liquidated' | 'redeemed'
  tx_hash: string
  block_number: bigint
  timestamp: bigint
  data: Record<string, unknown>
}

export const VALID_STATUSES: readonly InscriptionStatus[] = [
  'open', 'partial', 'filled', 'repaid', 'liquidated', 'expired', 'cancelled',
] as const

/** Human-readable labels for each inscription status */
export const STATUS_LABELS: Record<InscriptionStatus, string> = {
  open: 'Open',
  partial: 'Partial',
  filled: 'Filled',
  repaid: 'Repaid',
  liquidated: 'Liquidated',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

/** Numeric enum values for asset types (matches Cairo contract) */
export const ASSET_TYPE_ENUM: Record<AssetType, number> = {
  ERC20: 0,
  ERC721: 1,
  ERC1155: 2,
  ERC4626: 3,
}

/** Reverse mapping: numeric enum value -> AssetType name */
export const ASSET_TYPE_NAMES: Record<number, AssetType> = {
  0: 'ERC20',
  1: 'ERC721',
  2: 'ERC1155',
  3: 'ERC4626',
}

// ---------------------------------------------------------------------------
// Webhook types (Apibara indexer → CF Worker)
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | 'created'
  | 'signed'
  | 'cancelled'
  | 'repaid'
  | 'liquidated'
  | 'redeemed'
  | 'transfer_single'
  | 'order_settled'
  | 'private_settled'
  | 'private_redeemed'

export interface WebhookEvent {
  event_type: WebhookEventType
  tx_hash: string
  block_number: number
  timestamp: number
  data: Record<string, unknown>
}

export interface WebhookPayload {
  block_number: number
  events: WebhookEvent[]
  cursor: string
}
