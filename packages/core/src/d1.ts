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

/**
 * Normalize a StarkNet address to a canonical lowercase 0x-padded form.
 * This avoids needing separate padded/unpadded comparisons in SQL queries.
 */
function normalizeAddress(address: string): string {
  const stripped = address.replace(/^0x/i, '').toLowerCase()
  return '0x' + stripped.padStart(64, '0')
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
      const limit = Math.min(rawLimit, 50)
      const conditions: string[] = []
      const params: unknown[] = []

      if (status === 'expired') {
        const nowSeconds = Math.floor(Date.now() / 1000)
        conditions.push(
          '((status = ? AND CAST(deadline AS INTEGER) < ?) OR (status = ? AND (CAST(signed_at AS INTEGER) + CAST(duration AS INTEGER)) < ?))'
        )
        params.push('open', nowSeconds, 'filled', nowSeconds)
      } else if (status && isValidStatus(status)) {
        conditions.push('status = ?')
        params.push(status)
      }

      if (address) {
        // Compare all possible address forms: padded (66 chars), original, stripped (no leading zeros)
        const lower = address.toLowerCase()
        const padded = normalizeAddress(address)
        const stripped = '0x' + address.replace(/^0x0*/i, '').toLowerCase()
        const variants = [...new Set([padded, lower, stripped])]
        const creatorChecks = variants.map(() => 'LOWER(creator) = ?').join(' OR ')
        const borrowerChecks = variants.map(() => 'LOWER(borrower) = ?').join(' OR ')
        const lenderChecks = variants.map(() => 'LOWER(lender) = ?').join(' OR ')
        conditions.push(`(${creatorChecks} OR ${borrowerChecks} OR ${lenderChecks})`)
        params.push(...variants, ...variants, ...variants)
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

      // SQLite checks NOT NULL constraints before ON CONFLICT resolution.
      // When 'creator' (NOT NULL) is missing, the row must already exist —
      // fall back to a plain UPDATE to avoid constraint violations.
      if (!keys.includes('creator')) {
        const updateKeys = keys.filter((k) => k !== 'id')
        if (updateKeys.length === 0) return
        const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(', ')
        const updateValues = updateKeys.map((k) => values[keys.indexOf(k)])
        await db
          .prepare(`UPDATE inscriptions SET ${setClauses} WHERE id = ?`)
          .bind(...updateValues, values[keys.indexOf('id')])
          .run()
        return
      }

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
          `INSERT OR IGNORE INTO inscription_events (inscription_id, event_type, tx_hash, block_number, timestamp, data)
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

    /**
     * Insert an event and return whether the row was actually inserted.
     * Returns false if the event was already present (dedup via unique index).
     */
    async insertEventReturning(event: {
      inscription_id: string
      event_type: string
      tx_hash: string
      block_number: number
      timestamp?: number
      data?: Record<string, unknown>
    }): Promise<boolean> {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO inscription_events (inscription_id, event_type, tx_hash, block_number, timestamp, data)
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
      return ((result.meta?.changes as number) ?? 0) > 0
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

    async setMeta(key: string, value: string) {
      await db
        .prepare('INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)')
        .bind(key, value)
        .run()
    },

    async getMeta(key: string): Promise<string | null> {
      const row = await db
        .prepare('SELECT value FROM _meta WHERE key = ?')
        .bind(key)
        .first<{ value: string }>()
      return row ? row.value : null
    },

    // -----------------------------------------------------------------------
    // Expire open inscriptions past their deadline (no lender signed)
    // -----------------------------------------------------------------------

    async expireOpenInscriptions(nowSeconds: number): Promise<number> {
      const result = await db
        .prepare(
          `UPDATE inscriptions
           SET status = 'expired', updated_at_ts = ?
           WHERE status = 'open'
             AND deadline > 0
             AND deadline < ?`
        )
        .bind(nowSeconds, nowSeconds)
        .run()
      return (result.meta?.changes as number) ?? 0
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
      // Use BigInt in JS — CAST(AS INTEGER) overflows for u256-scale share values
      const row = await db
        .prepare('SELECT balance FROM share_balances WHERE account = ? AND inscription_id = ?')
        .bind(account, inscriptionId)
        .first<{ balance: string }>()
      let current = 0n
      if (row) {
        try { current = BigInt(row.balance) } catch { current = 0n }
      }
      const newBalance = (current + amount).toString()
      await db
        .prepare(
          `INSERT OR REPLACE INTO share_balances (account, inscription_id, balance) VALUES (?, ?, ?)`
        )
        .bind(account, inscriptionId, newBalance)
        .run()
    },

    async decrementShareBalance(account: string, inscriptionId: string, amount: bigint): Promise<void> {
      // Use BigInt in JS — CAST(AS INTEGER) overflows for u256-scale share values
      const row = await db
        .prepare('SELECT balance FROM share_balances WHERE account = ? AND inscription_id = ?')
        .bind(account, inscriptionId)
        .first<{ balance: string }>()
      if (!row) return
      let current = 0n
      try { current = BigInt(row.balance) } catch { current = 0n }
      const newBalance = (current > amount ? current - amount : 0n).toString()
      await db
        .prepare('UPDATE share_balances SET balance = ? WHERE account = ? AND inscription_id = ?')
        .bind(newBalance, account, inscriptionId)
        .run()
    },

    async getShareBalances(account: string): Promise<{ inscription_id: string; balance: string }[]> {
      const result = await db
        .prepare(
          `SELECT inscription_id, balance FROM share_balances
           WHERE account = ? AND balance != '0' AND length(balance) > 0
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

    // -----------------------------------------------------------------------
    // Off-chain orders
    // -----------------------------------------------------------------------

    async createOrder(order: {
      id: string
      borrower: string
      order_data: string
      borrower_signature: string
      nonce: string
      deadline: number
      created_at: number
    }) {
      await db
        .prepare(
          `INSERT INTO orders (id, borrower, order_data, borrower_signature, nonce, status, deadline, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
        )
        .bind(order.id, normalizeAddress(order.borrower), order.order_data, order.borrower_signature, order.nonce, order.deadline, order.created_at)
        .run()
    },

    async getOrder(id: string) {
      return db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id)
        .first()
    },

    async getOrders({ status, address, page, limit: rawLimit }: GetInscriptionsParams) {
      const limit = Math.min(rawLimit, 50)
      const conditions: string[] = []
      const params: unknown[] = []

      if (status && status !== 'all') {
        conditions.push('status = ?')
        params.push(status)
      }

      if (address) {
        // Compare all possible address forms: padded (66 chars), original, stripped (no leading zeros)
        const lower = address.toLowerCase()
        const padded = normalizeAddress(address)
        const stripped = '0x' + address.replace(/^0x0*/i, '').toLowerCase()
        const variants = [...new Set([padded, lower, stripped])]
        const borrowerChecks = variants.map(() => 'LOWER(borrower) = ?').join(' OR ')
        const lenderChecks = variants.map(() => 'LOWER(lender) = ?').join(' OR ')
        conditions.push(
          `(${borrowerChecks} OR id IN (SELECT order_id FROM order_offers WHERE ${lenderChecks}))`
        )
        params.push(...variants, ...variants)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const offset = (page - 1) * limit

      const result = await db
        .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...params, limit, offset)
        .all()

      return result.results
    },

    async updateOrderStatus(id: string, status: string) {
      await db
        .prepare('UPDATE orders SET status = ? WHERE id = ?')
        .bind(status, id)
        .run()
    },

    async updateOfferStatus(id: string, status: string) {
      await db
        .prepare('UPDATE order_offers SET status = ? WHERE id = ?')
        .bind(status, id)
        .run()
    },

    async createOrderOffer(offer: {
      id: string
      order_id: string
      lender: string
      bps: number
      lender_signature: string
      nonce: string
      created_at: number
    }) {
      await db
        .prepare(
          `INSERT INTO order_offers (id, order_id, lender, bps, lender_signature, nonce, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
        )
        .bind(offer.id, offer.order_id, offer.lender, offer.bps, offer.lender_signature, offer.nonce, offer.created_at)
        .run()
    },

    async getOrderOffers(orderId: string) {
      const result = await db
        .prepare('SELECT * FROM order_offers WHERE order_id = ? ORDER BY created_at DESC')
        .bind(orderId)
        .all()
      return result.results
    },

    async getMatchedOrders(): Promise<{ order_id: string; offer_id: string }[]> {
      const result = await db
        .prepare(
          `SELECT o.id as order_id, oo.id as offer_id
           FROM orders o
           JOIN order_offers oo ON oo.order_id = o.id
           WHERE o.status = 'matched'
             AND oo.status = 'pending'
             AND o.deadline > ?
           ORDER BY o.created_at ASC
           LIMIT 20`
        )
        .bind(Math.floor(Date.now() / 1000))
        .all<{ order_id: string; offer_id: string }>()
      return result.results
    },

    async expireOrders(nowSeconds: number): Promise<number> {
      const result = await db
        .prepare(
          `UPDATE orders SET status = 'expired'
           WHERE status = 'pending' AND deadline > 0 AND deadline < ?`
        )
        .bind(nowSeconds)
        .run()
      return (result.meta?.changes as number) ?? 0
    },
  }
}

export type D1Queries = ReturnType<typeof createD1Queries>
