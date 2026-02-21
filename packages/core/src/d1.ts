/**
 * Shared D1 query module — used by all Workers and Next.js API routes.
 *
 * D1 is Cloudflare's SQLite database. All queries use prepared statements
 * with positional `?` parameters to prevent SQL injection.
 */

import type { InscriptionStatus } from './types.js'
import { VALID_STATUSES } from './types.js'

/** Minimal D1 interface so callers don't need wrangler types at compile time */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(sql: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>
  run(): Promise<D1Result>
}

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

export interface D1ExecResult {
  count: number
  duration: number
}

// ---------------------------------------------------------------------------
// Allowlisted columns for inscription upserts — prevents SQL injection
// ---------------------------------------------------------------------------

const INSCRIPTION_COLUMNS = new Set([
  'id', 'creator', 'borrower', 'lender', 'status',
  'issued_debt_percentage', 'multi_lender', 'duration', 'deadline',
  'signed_at', 'debt_asset_count', 'interest_asset_count',
  'collateral_asset_count', 'created_at_block', 'created_at_ts', 'updated_at_ts',
])

function isValidStatus(s: string): s is InscriptionStatus {
  return (VALID_STATUSES as readonly string[]).includes(s)
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface GetInscriptionsParams {
  status?: string
  address?: string
  page: number
  limit: number
}

export function createD1Queries(db: D1Database) {
  return {
    // -----------------------------------------------------------------------
    // Reads
    // -----------------------------------------------------------------------

    async getInscriptions({ status, address, page, limit: rawLimit }: GetInscriptionsParams) {
      const limit = Math.min(rawLimit, 100)
      const conditions: string[] = []
      const params: unknown[] = []

      if (status && isValidStatus(status)) {
        conditions.push('status = ?')
        params.push(status)
      }

      if (address) {
        // Normalize: handle both padded (0x049d3...) and unpadded (0x49d3...) StarkNet addresses
        const stripped = address.replace(/^0x/i, '').toLowerCase()
        const padded = '0x' + stripped.padStart(64, '0')
        const unpadded = '0x' + (stripped.replace(/^0+/, '') || '0')
        conditions.push('(LOWER(creator) IN (?, ?) OR LOWER(borrower) IN (?, ?) OR LOWER(lender) IN (?, ?))')
        params.push(padded, unpadded, padded, unpadded, padded, unpadded)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const offset = (page - 1) * limit

      const result = await db
        .prepare(
          `SELECT * FROM inscriptions ${where} ORDER BY created_at_ts DESC LIMIT ? OFFSET ?`
        )
        .bind(...params, limit, offset)
        .all()

      return result.results
    },

    async getInscription(id: string) {
      return db
        .prepare('SELECT * FROM inscriptions WHERE id = ?')
        .bind(id)
        .first()
    },

    async getInscriptionAssets(inscriptionId: string) {
      const result = await db
        .prepare('SELECT * FROM inscription_assets WHERE inscription_id = ? ORDER BY asset_role, asset_index')
        .bind(inscriptionId)
        .all()
      return result.results
    },

    async getAssetsForInscriptions(ids: string[]) {
      if (ids.length === 0) return []
      const placeholders = ids.map(() => '?').join(', ')
      const result = await db
        .prepare(
          `SELECT * FROM inscription_assets WHERE inscription_id IN (${placeholders}) ORDER BY inscription_id, asset_role, asset_index`
        )
        .bind(...ids)
        .all()
      return result.results
    },

    // -----------------------------------------------------------------------
    // Writes
    // -----------------------------------------------------------------------

    async upsertInscription(inscription: Record<string, unknown>) {
      const keys: string[] = []
      const values: unknown[] = []

      for (const [key, val] of Object.entries(inscription)) {
        if (!INSCRIPTION_COLUMNS.has(key)) continue
        keys.push(key)
        values.push(val)
      }

      if (keys.length === 0 || !keys.includes('id')) return

      const placeholders = keys.map(() => '?').join(', ')
      const updates = keys
        .filter((k) => k !== 'id')
        .map((k) => `"${k}" = excluded."${k}"`)
        .join(', ')

      await db
        .prepare(
          `INSERT INTO inscriptions (${keys.map((k) => `"${k}"`).join(', ')})
           VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updates}`
        )
        .bind(...values)
        .run()
    },

    async insertEvent(event: {
      inscription_id: string
      event_type: string
      tx_hash: string
      block_number: number
      timestamp?: number
      data?: Record<string, unknown>
    }) {
      await db
        .prepare(
          `INSERT INTO inscription_events (inscription_id, event_type, tx_hash, block_number, timestamp, data)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          event.inscription_id,
          event.event_type,
          event.tx_hash,
          event.block_number,
          event.timestamp ?? null,
          event.data ? JSON.stringify(event.data) : null
        )
        .run()
    },

    async updateInscriptionStatus(id: string, status: string, updatedAt: number) {
      if (!isValidStatus(status)) {
        throw new Error(`Invalid inscription status: ${status}`)
      }
      await db
        .prepare('UPDATE inscriptions SET status = ?, updated_at_ts = ? WHERE id = ?')
        .bind(status, updatedAt, id)
        .run()
    },

    async insertAsset(asset: {
      inscription_id: string
      asset_role: string
      asset_index: number
      asset_address: string
      asset_type: string
      value?: string
      token_id?: string
    }) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO inscription_assets
           (inscription_id, asset_role, asset_index, asset_address, asset_type, value, token_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          asset.inscription_id,
          asset.asset_role,
          asset.asset_index,
          asset.asset_address,
          asset.asset_type,
          asset.value ?? null,
          asset.token_id ?? null
        )
        .run()
    },

    // -----------------------------------------------------------------------
    // Meta (indexer block cursor)
    // -----------------------------------------------------------------------

    async getLastBlock(): Promise<number> {
      const row = await db
        .prepare("SELECT value FROM _meta WHERE key = 'last_block'")
        .first<{ value: string }>()
      return row ? Number(row.value) : 0
    },

    async setLastBlock(block: number) {
      await db
        .prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_block', ?)")
        .bind(String(block))
        .run()
    },

    // -----------------------------------------------------------------------
    // Bot: find liquidatable inscriptions
    // -----------------------------------------------------------------------

    async findLiquidatable(nowSeconds: number) {
      const result = await db
        .prepare(
          `SELECT id FROM inscriptions
           WHERE status = 'filled'
             AND signed_at IS NOT NULL
             AND (signed_at + duration) < ?
           ORDER BY (signed_at + duration) ASC
           LIMIT 50`
        )
        .bind(nowSeconds)
        .all<{ id: string }>()
      return result.results
    },

    // -----------------------------------------------------------------------
    // Locker queries
    // -----------------------------------------------------------------------

    async upsertLocker(inscriptionId: string, lockerAddress: string, timestamp: number): Promise<void> {
      await db
        .prepare(
          `INSERT OR REPLACE INTO lockers (inscription_id, locker_address, created_at_ts)
           VALUES (?, ?, ?)`
        )
        .bind(inscriptionId, lockerAddress, timestamp)
        .run()
    },

    async getLockerAddress(inscriptionId: string): Promise<string | null> {
      const row = await db
        .prepare('SELECT locker_address FROM lockers WHERE inscription_id = ?')
        .bind(inscriptionId)
        .first<{ locker_address: string }>()
      return row ? row.locker_address : null
    },

    async getLockersByCreator(address: string): Promise<{ inscription_id: string; locker_address: string }[]> {
      const result = await db
        .prepare(
          `SELECT l.inscription_id, l.locker_address
           FROM lockers l
           JOIN inscriptions i ON i.id = l.inscription_id
           WHERE LOWER(i.creator) = LOWER(?)`
        )
        .bind(address)
        .all<{ inscription_id: string; locker_address: string }>()
      return result.results
    },

    // -----------------------------------------------------------------------
    // Share balance queries
    // -----------------------------------------------------------------------

    async incrementShareBalance(account: string, inscriptionId: string, amount: bigint): Promise<void> {
      await db
        .prepare(
          `INSERT INTO share_balances (account, inscription_id, balance)
           VALUES (?, ?, ?)
           ON CONFLICT (account, inscription_id) DO UPDATE
           SET balance = CAST((CAST(balance AS INTEGER) + CAST(excluded.balance AS INTEGER)) AS TEXT)`
        )
        .bind(account, inscriptionId, amount.toString())
        .run()
    },

    async decrementShareBalance(account: string, inscriptionId: string, amount: bigint): Promise<void> {
      await db
        .prepare(
          `UPDATE share_balances
           SET balance = CAST(MAX(0, CAST(balance AS INTEGER) - ?) AS TEXT)
           WHERE account = ? AND inscription_id = ?`
        )
        .bind(amount.toString(), account, inscriptionId)
        .run()
    },

    async getShareBalances(account: string): Promise<{ inscription_id: string; balance: string }[]> {
      const result = await db
        .prepare(
          `SELECT inscription_id, balance FROM share_balances
           WHERE account = ? AND CAST(balance AS INTEGER) > 0
           ORDER BY inscription_id`
        )
        .bind(account)
        .all<{ inscription_id: string; balance: string }>()
      return result.results
    },

    async getShareBalance(account: string, inscriptionId: string): Promise<string> {
      const row = await db
        .prepare('SELECT balance FROM share_balances WHERE account = ? AND inscription_id = ?')
        .bind(account, inscriptionId)
        .first<{ balance: string }>()
      return row ? row.balance : '0'
    },

    // -----------------------------------------------------------------------
    // Treasury aggregation
    // -----------------------------------------------------------------------

    async getLockedAssetsByAddress(address: string): Promise<{
      inscription_id: string; asset_address: string; asset_type: string;
      value: string; token_id: string; status: string;
    }[]> {
      const result = await db
        .prepare(
          `SELECT ia.inscription_id, ia.asset_address, ia.asset_type,
                  ia.value, ia.token_id, i.status
           FROM inscription_assets ia
           JOIN inscriptions i ON i.id = ia.inscription_id
           WHERE LOWER(i.creator) = LOWER(?)
             AND i.status IN ('filled', 'partial')
             AND ia.asset_role = 'collateral'
           ORDER BY ia.inscription_id`
        )
        .bind(address)
        .all<{
          inscription_id: string; asset_address: string; asset_type: string;
          value: string; token_id: string; status: string;
        }>()
      return result.results
    },

    // -----------------------------------------------------------------------
    // Inscription events
    // -----------------------------------------------------------------------

    async getInscriptionEvents(inscriptionId: string) {
      const result = await db
        .prepare(
          `SELECT * FROM inscription_events
           WHERE inscription_id = ?
           ORDER BY block_number ASC, id ASC`
        )
        .bind(inscriptionId)
        .all()
      return result.results
    },
  }
}

export type D1Queries = ReturnType<typeof createD1Queries>
