/**
 * Shared order data parsing utilities.
 *
 * Used by API routes (server) and UI components (client) to normalize
 * the flexible order_data JSON from D1 into a consistent shape.
 */

export interface SerializedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

export interface RawOrderData {
  borrower?: string
  debt_assets?: SerializedAsset[]
  interest_assets?: SerializedAsset[]
  collateral_assets?: SerializedAsset[]
  debtAssets?: SerializedAsset[]
  interestAssets?: SerializedAsset[]
  collateralAssets?: SerializedAsset[]
  multi_lender?: boolean
  multiLender?: boolean
  duration?: string
  deadline?: string
  nonce?: string
  orderHash?: string
}

export interface ParsedOrderData {
  borrower: string
  debtAssets: SerializedAsset[]
  interestAssets: SerializedAsset[]
  collateralAssets: SerializedAsset[]
  duration: string
  deadline: string
  multiLender: boolean
}

/** Normalize camelCase/snake_case variants in order_data JSON. */
export function normalizeOrderData(raw: RawOrderData): ParsedOrderData {
  return {
    borrower: raw.borrower ?? '',
    debtAssets: raw.debt_assets ?? raw.debtAssets ?? [],
    interestAssets: raw.interest_assets ?? raw.interestAssets ?? [],
    collateralAssets: raw.collateral_assets ?? raw.collateralAssets ?? [],
    duration: raw.duration ?? '0',
    deadline: raw.deadline ?? '0',
    multiLender: raw.multi_lender ?? raw.multiLender ?? false,
  }
}

/** Parse the order_data TEXT column from D1 into a proper object.
 *  Shared between GET /api/orders and GET /api/orders/[id]. */
export function parseOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  let parsed: Record<string, unknown> = {}
  const raw = row.order_data
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { parsed = {} }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>
  }

  const debtAssets = parsed.debtAssets ?? parsed.debt_assets ?? []
  const interestAssets = parsed.interestAssets ?? parsed.interest_assets ?? []
  const collateralAssets = parsed.collateralAssets ?? parsed.collateral_assets ?? []

  return {
    ...row,
    order_data: {
      borrower: parsed.borrower ?? '',
      debtAssets,
      interestAssets,
      collateralAssets,
      debtCount: (debtAssets as unknown[]).length,
      interestCount: (interestAssets as unknown[]).length,
      collateralCount: (collateralAssets as unknown[]).length,
      duration: String(parsed.duration ?? '0'),
      deadline: String(parsed.deadline ?? '0'),
      multiLender: parsed.multiLender ?? parsed.multi_lender ?? false,
      nonce: String(parsed.nonce ?? row.nonce ?? '0'),
      orderHash: parsed.orderHash ?? undefined,
    },
  }
}
