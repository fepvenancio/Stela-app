import type { InscriptionStatus } from '@stela/core'

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
