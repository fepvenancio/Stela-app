/** Environment bindings for the indexer worker */
export interface Env {
  DB: D1Database
  STELA_ADDRESS: string
  RPC_URL: string
  TRIGGER_SECRET?: string
}

/** Raw event from starknet.js getEvents */
export interface RpcEvent {
  keys: string[]
  data: string[]
  transaction_hash: string
  block_number: number
  block_hash: string
}

/** Paginated getEvents RPC response */
export interface GetEventsResult {
  events: RpcEvent[]
  continuation_token?: string
}

/** Enriched event with resolved block timestamp */
export interface IndexerEvent {
  keys: string[]
  data: string[]
  transaction_hash: string
  block_number: number
  timestamp: number
}

/** Asset extracted from transaction calldata */
export interface ParsedAsset {
  asset_address: string
  asset_type: string
  value: string
  token_id: string
}

/** On-chain inscription data fetched from the contract */
export interface OnChainInscription {
  multi_lender: boolean
  duration: number
  deadline: number
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
}
