import type { InscriptionStatus } from '@fepvenancio/stela-sdk'

/** Row shape returned by the /api/inscriptions list endpoint */
export interface InscriptionRow {
  id: string
  creator: string
  borrower: string | null
  lender: string | null
  status: string
  issued_debt_percentage: string
  multi_lender: boolean
  duration: string
  deadline: string
  signed_at: string | null
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
  created_at_ts: string
  auction_started: number   // 0 or 1
  auction_start_time: string
  assets: AssetRow[]
}

/** Asset row shape from the D1 inscription_assets table */
export interface AssetRow {
  inscription_id: string
  asset_role: 'debt' | 'interest' | 'collateral'
  asset_index: number
  asset_address: string
  asset_type: string
  value: string | null
  token_id: string | null
}

/** Response shape for GET /api/inscriptions/[id] */
export interface InscriptionDetailResponse extends InscriptionRow {
  assets: AssetRow[]
}

/** Collection offer row from D1 */
export interface CollectionOfferRow {
  id: string
  lender: string
  collection_address: string
  order_data: Record<string, unknown>
  lender_signature: string
  nonce: string
  status: string
  deadline: string
  created_at: string
  debt_token: string | null
  collateral_token: string | null
  acceptance?: {
    borrower: string
    token_id: string
    borrower_signature: string
    nonce: string
  }
}

/** Refinance offer row from D1 */
export interface RefinanceRow {
  id: string
  inscription_id: string
  new_lender: string
  order_data: Record<string, unknown>
  lender_signature: string
  nonce: string
  status: string
  deadline: string
  created_at: string
  approval?: {
    borrower: string
    borrower_signature: string
    nonce: string
  }
}

/** Renegotiation proposal row from D1 */
export interface RenegotiationRow {
  id: string
  inscription_id: string
  proposer: string
  proposal_data: Record<string, unknown>
  proposer_signature: string
  nonce: string
  status: string
  deadline: string
  created_at: string
}

/** Collateral sale row from D1 */
export interface CollateralSaleRow {
  id: string
  inscription_id: string
  buyer: string
  offer_data: Record<string, unknown>
  borrower_signature: string
  min_price: string
  status: string
  deadline: string
  created_at: string
}

/** Params for the inscriptions list hook */
export interface InscriptionListParams {
  status?: InscriptionStatus | string
  address?: string
  page?: number
}

/** Standard API response envelope for list endpoints */
export interface ApiListResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

/** Standard API response envelope for detail endpoints */
export interface ApiDetailResponse<T> {
  data: T
}
