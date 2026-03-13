/** Order book types — shared between API and UI */

/** A single price level in the lending order book */
export interface LendingLevel {
  /** Annualized percentage rate for this level */
  apr: number
  /** Total debt amount available at this APR (raw string for BigInt compat) */
  totalAmount: string
  /** Number of orders at this level */
  orderCount: number
  /** Running cumulative total from best to worst */
  cumulative: string
  /** Individual orders at this level */
  orders: {
    id: string
    amount: string
    creator: string
    source: 'offchain' | 'onchain'
    duration: number
    multiLender: boolean
    deadline: number
    interestAmount: string
    interestSymbol: string
    interestDecimals: number
  }[]
}

/** A single price level in the swap order book */
export interface SwapLevel {
  /** Exchange rate: units of quote per unit of base */
  rate: number
  /** Total base amount available at this rate */
  totalAmount: string
  /** Number of orders at this level */
  orderCount: number
  /** Running cumulative total from best to worst */
  cumulative: string
  /** Individual orders */
  orders: {
    id: string
    amount: string
    creator: string
    source: 'offchain' | 'onchain'
    deadline: number
  }[]
}

/** Token info for display */
export interface TokenDisplay {
  address: string
  symbol: string
  decimals: number
  logoUrl?: string
}

/** Full order book response from API */
export interface OrderBookResponse {
  pair: {
    base: TokenDisplay   // debt token
    quote: TokenDisplay   // collateral token
  }
  /** Available duration values for lending orders */
  durations: number[]
  /** Lending order book (duration > 0) */
  lending: {
    /** Borrow requests — sorted highest APR first (best for lenders) */
    asks: LendingLevel[]
    /** Total borrow demand */
    totalAskVolume: string
  }
  /** Swap order book (duration = 0) */
  swaps: {
    /** Sell base (want quote) — sorted lowest rate first */
    asks: SwapLevel[]
    /** Buy base (want base, pay quote) — sorted highest rate first */
    bids: SwapLevel[]
    totalAskVolume: string
    totalBidVolume: string
  }
  /** Recently settled/filled orders */
  recentFills: {
    id: string
    apr: number
    rate: number
    amount: string
    duration: number
    filledAt: number
    source: 'offchain' | 'onchain'
    type: 'lending' | 'swap'
  }[]
}

/** Duration filter options */
export type DurationFilter = 'all' | '7d' | '30d' | '90d' | '180d' | '365d'

/** Duration filter to seconds mapping */
export const DURATION_RANGES: Record<DurationFilter, [number, number] | null> = {
  all: null,
  '7d': [0, 7 * 86400 + 1],
  '30d': [7 * 86400, 30 * 86400 + 1],
  '90d': [30 * 86400, 90 * 86400 + 1],
  '180d': [90 * 86400, 180 * 86400 + 1],
  '365d': [180 * 86400, 366 * 86400],
}
