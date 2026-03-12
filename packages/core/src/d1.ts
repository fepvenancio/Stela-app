/**
 * Shared D1 query module — used by all Workers and Next.js API routes.
 *
 * D1 is Cloudflare's SQLite database. All queries use prepared statements
 * with positional `?` parameters to prevent SQL injection.
 */

import type { InscriptionStatus } from './types.js'
import { VALID_STATUSES } from './types.js'
import { normalizeAddress } from './u256.js'

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

/** Valid order status values — prevents arbitrary status strings in D1 */
const VALID_ORDER_STATUSES = new Set(['pending', 'matched', 'settled', 'expired', 'cancelled'])

/** Valid offer status values */
const VALID_OFFER_STATUSES = new Set(['pending', 'settled', 'expired', 'cancelled'])

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface GetInscriptionsParams {
  status?: string
  address?: string
  page: number
  limit: number
}

export interface PairAggregate {
  debt_token: string
  collateral_token: string
  open_count: number
  total_count: number
  total_volume: string
  pending_order_count: number
}

export function createD1Queries(db: D1Database) {
  return {
    /** Expose the raw D1 database handle for batch operations */
    get db() { return db },
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
        // Compare all possible address forms to handle old/unnormalized data in D1:
        // 1. Padded (66 chars with zeros)
        // 2. Stripped (no leading zeros)
        // 3. Original lowercased
        const padded = normalizeAddress(address)
        const stripped = '0x' + address.replace(/^0x0*/i, '').toLowerCase()
        const variants = [...new Set([padded, stripped, address.toLowerCase()])]
        
        // Build the OR checks for each variant across all three roles
        const creatorChecks = variants.map(() => 'creator = ?').join(' OR ')
        const borrowerChecks = variants.map(() => 'borrower = ?').join(' OR ')
        const lenderChecks = variants.map(() => 'lender = ?').join(' OR ')
        
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

    async insertAssetsBatch(assets: Array<{
      inscription_id: string
      asset_role: string
      asset_index: number
      asset_address: string
      asset_type: string
      value: string
      token_id: string
    }>): Promise<void> {
      if (assets.length === 0) return
      const statements = assets.map(a =>
        db.prepare(
          `INSERT OR IGNORE INTO inscription_assets
           (inscription_id, asset_role, asset_index, asset_address, asset_type, value, token_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(a.inscription_id, a.asset_role, a.asset_index, a.asset_address, a.asset_type, a.value, a.token_id)
      )
      await db.batch(statements)
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

    /**
     * D1-backed write rate limiter. Persists across cold starts.
     * Key: `rl:{identifier}`, value: `{minute_bucket}:{count}`.
     * Returns true if the identifier has exceeded maxPerMinute writes.
     */
    /**
     * Atomic lock acquisition using conditional UPDATE.
     * Returns true if lock was acquired, false if held by another instance.
     * Eliminates TOCTOU race by combining read + write into one statement.
     */
    async tryAcquireLock(key: string, nowSeconds: number, ttlSeconds: number): Promise<boolean> {
      // Attempt atomic CAS: update only if lock is stale or unset
      const staleThreshold = nowSeconds - ttlSeconds
      const result = await db
        .prepare(
          `UPDATE _meta SET value = ? WHERE key = ? AND (CAST(value AS INTEGER) < ? OR value = '0')`
        )
        .bind(String(nowSeconds), key, staleThreshold)
        .run()
      const updated = (result.meta?.changes as number) ?? 0

      if (updated > 0) return true

      // Row might not exist yet — try INSERT, ignoring conflict
      try {
        await db
          .prepare(`INSERT INTO _meta (key, value) VALUES (?, ?)`)
          .bind(key, String(nowSeconds))
          .run()
        return true
      } catch {
        // Row exists and lock is fresh — another instance holds it
        return false
      }
    },

    async checkWriteRateLimit(identifier: string, maxPerMinute: number): Promise<boolean> {
      const bucket = Math.floor(Date.now() / 60_000)
      const key = `rl:${identifier}`
      const row = await db
        .prepare('SELECT value FROM _meta WHERE key = ?')
        .bind(key)
        .first<{ value: string }>()

      let count = 0
      if (row) {
        const [storedBucket, storedCount] = row.value.split(':')
        if (Number(storedBucket) === bucket) {
          count = Number(storedCount)
        }
        // If bucket is old, count resets to 0
      }

      if (count >= maxPerMinute) return true

      await db
        .prepare('INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)')
        .bind(key, `${bucket}:${count + 1}`)
        .run()
      return false
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
      const amountStr = amount.toString()
      await db
        .prepare(
          `INSERT INTO share_balances (account, inscription_id, balance)
           VALUES (?, ?, ?)
           ON CONFLICT(account, inscription_id)
           DO UPDATE SET balance = CAST(CAST(share_balances.balance AS INTEGER) + CAST(excluded.balance AS INTEGER) AS TEXT)`
        )
        .bind(account, inscriptionId, amountStr)
        .run()
    },

    async decrementShareBalance(account: string, inscriptionId: string, amount: bigint): Promise<void> {
      const amountStr = amount.toString()
      await db
        .prepare(
          `UPDATE share_balances
           SET balance = CAST(MAX(0, CAST(balance AS INTEGER) - CAST(? AS INTEGER)) AS TEXT)
           WHERE account = ? AND inscription_id = ?`
        )
        .bind(amountStr, account, inscriptionId)
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
    // Hybrid: find on-chain inscriptions compatible with off-chain lend offers
    // -----------------------------------------------------------------------

    async findCompatibleInscriptions(params: {
      debtToken: string
      collateralToken: string
      duration?: number
      excludeBorrower: string
      limit?: number
    }): Promise<Array<{
      id: string
      creator: string
      borrower: string
      duration: number
      deadline: number
      status: string
    }>> {
      const normalizedDebt = normalizeAddress(params.debtToken)
      const normalizedCollateral = normalizeAddress(params.collateralToken)
      const normalizedBorrower = normalizeAddress(params.excludeBorrower)
      const limit = Math.min(params.limit ?? 10, 50)

      const conditions: string[] = [
        `i.status = 'open'`,
        `i.multi_lender = 0`,
        `LOWER(i.creator) != LOWER(?)`,
      ]
      const bindParams: unknown[] = [normalizedBorrower]

      if (params.duration !== undefined) {
        conditions.push(`CAST(i.duration AS INTEGER) = ?`)
        bindParams.push(params.duration)
      }

      const where = conditions.join(' AND ')

      const result = await db
        .prepare(
          `SELECT DISTINCT i.id, i.creator, i.borrower, i.duration, i.deadline, i.status
           FROM inscriptions i
           JOIN inscription_assets ia_debt
             ON ia_debt.inscription_id = i.id
             AND ia_debt.asset_role = 'debt'
             AND LOWER(ia_debt.asset_address) = LOWER(?)
           JOIN inscription_assets ia_coll
             ON ia_coll.inscription_id = i.id
             AND ia_coll.asset_role = 'collateral'
             AND LOWER(ia_coll.asset_address) = LOWER(?)
           WHERE ${where}
           ORDER BY i.created_at_ts DESC
           LIMIT ?`
        )
        .bind(normalizedCollateral, normalizedDebt, ...bindParams, limit)
        .all<{
          id: string
          creator: string
          borrower: string
          duration: number
          deadline: number
          status: string
        }>()

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
      debt_token?: string | null
      collateral_token?: string | null
      duration_seconds?: number | null
    }) {
      await db
        .prepare(
          `INSERT INTO orders (id, borrower, order_data, borrower_signature, nonce, status, deadline, created_at, debt_token, collateral_token, duration_seconds)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
        )
        .bind(order.id, normalizeAddress(order.borrower), order.order_data, order.borrower_signature, order.nonce, order.deadline, order.created_at, order.debt_token ?? null, order.collateral_token ?? null, order.duration_seconds ?? null)
        .run()
    },

    async getOrder(id: string) {
      return db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .bind(id)
        .first()
    },

    async findCompatibleOrders(params: {
      myDebtToken: string
      myCollateralToken: string
      duration: number
      borrower: string
      nowSeconds: number
    }): Promise<Record<string, unknown>[]> {
      // My debt token = their collateral (what they locked, what I want to borrow)
      // My collateral token = their debt (what they want to borrow, what I can lend)
      const normalizedDebt = normalizeAddress(params.myDebtToken)
      const normalizedCollateral = normalizeAddress(params.myCollateralToken)
      const normalizedBorrower = normalizeAddress(params.borrower)

      const result = await db
        .prepare(
          `SELECT id, borrower, order_data, borrower_signature, nonce, deadline, created_at
           FROM orders
           WHERE status = 'pending'
             AND deadline > ?
             AND debt_token = ?
             AND collateral_token = ?
             AND duration_seconds = ?
             AND borrower != ?
             AND borrower_signature IS NOT NULL
           ORDER BY created_at ASC
           LIMIT 20`
        )
        .bind(
          params.nowSeconds,
          normalizedCollateral,  // matches their debt_token (they want what I offer)
          normalizedDebt,        // matches their collateral_token (they offer what I want)
          params.duration,
          normalizedBorrower,
        )
        .all<Record<string, unknown>>()
      return result.results
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
        // Compare all possible address forms to handle old/unnormalized data in D1
        const padded = normalizeAddress(address)
        const stripped = '0x' + address.replace(/^0x0*/i, '').toLowerCase()
        const variants = [...new Set([padded, stripped, address.toLowerCase()])]
        
        const borrowerChecks = variants.map(() => 'borrower = ?').join(' OR ')
        const lenderChecks = variants.map(() => 'lender = ?').join(' OR ')
        
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
      if (!VALID_ORDER_STATUSES.has(status)) {
        throw new Error(`Invalid order status: ${status}`)
      }
      await db
        .prepare('UPDATE orders SET status = ? WHERE id = ?')
        .bind(status, id)
        .run()
    },

    /**
     * Atomic conditional status update — only updates if current status matches `fromStatus`.
     * Returns true if the row was updated, false if the status had already changed.
     * Eliminates TOCTOU race on concurrent offer submissions.
     */
    async updateOrderStatusConditional(id: string, fromStatus: string, toStatus: string): Promise<boolean> {
      if (!VALID_ORDER_STATUSES.has(toStatus)) {
        throw new Error(`Invalid order status: ${toStatus}`)
      }
      const result = await db
        .prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?')
        .bind(toStatus, id, fromStatus)
        .run()
      return ((result.meta?.changes as number) ?? 0) > 0
    },

    async updateOfferStatus(id: string, status: string) {
      if (!VALID_OFFER_STATUSES.has(status)) {
        throw new Error(`Invalid offer status: ${status}`)
      }
      await db
        .prepare('UPDATE order_offers SET status = ? WHERE id = ?')
        .bind(status, id)
        .run()
    },

    async purgeOrderSignature(orderId: string) {
      await db
        .prepare('UPDATE orders SET borrower_signature = NULL WHERE id = ?')
        .bind(orderId)
        .run()
    },

    async purgeOfferSignature(offerId: string) {
      await db
        .prepare('UPDATE order_offers SET lender_signature = NULL WHERE id = ?')
        .bind(offerId)
        .run()
    },

    /** Bulk-purge signatures on orders that are expired or cancelled (no longer settleable). */
    async purgeStaleSignatures(): Promise<number> {
      const r1 = await db
        .prepare(
          `UPDATE orders SET borrower_signature = NULL
           WHERE status IN ('expired', 'cancelled') AND borrower_signature IS NOT NULL`
        )
        .run()
      const r2 = await db
        .prepare(
          `UPDATE order_offers SET lender_signature = NULL
           WHERE (status = 'expired' OR order_id IN (SELECT id FROM orders WHERE status IN ('expired', 'cancelled')))
             AND lender_signature IS NOT NULL`
        )
        .run()
      return ((r1.meta?.changes as number) ?? 0) + ((r2.meta?.changes as number) ?? 0)
    },

    /**
     * Atomically create an offer and update the order status in a single D1 batch.
     * Returns true if the order was still pending and both operations succeeded.
     * Returns false if the order was already matched/settled (no offer created).
     */
    async acceptOffer(params: {
      offerId: string
      orderId: string
      lender: string
      bps: number
      lenderSignature: string
      nonce: string
      createdAt: number
      orderStatus: string
      offerStatus: string
    }): Promise<boolean> {
      if (!VALID_ORDER_STATUSES.has(params.orderStatus)) {
        throw new Error(`Invalid order status: ${params.orderStatus}`)
      }
      if (!VALID_OFFER_STATUSES.has(params.offerStatus)) {
        throw new Error(`Invalid offer status: ${params.offerStatus}`)
      }

      // Conditional update: only transitions if order is currently 'pending'
      const updateStmt = db
        .prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?')
        .bind(params.orderStatus, params.orderId, 'pending')

      const insertStmt = db
        .prepare(
          `INSERT INTO order_offers (id, order_id, lender, bps, lender_signature, nonce, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          params.offerId, params.orderId, params.lender, params.bps,
          params.lenderSignature, params.nonce, params.offerStatus, params.createdAt,
        )

      // D1 batch runs in a single SQLite transaction — both succeed or both roll back.
      const results = await db.batch([updateStmt, insertStmt])
      const orderUpdated = ((results[0].meta?.changes as number) ?? 0) > 0

      if (!orderUpdated) {
        // Order was not pending — the insert may have succeeded but is harmless
        // (orphan offer row for a non-pending order). Clean it up.
        await db
          .prepare('DELETE FROM order_offers WHERE id = ?')
          .bind(params.offerId)
          .run()
        return false
      }

      return true
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

    async getMatchedOrdersFull(): Promise<Record<string, unknown>[]> {
      const now = Math.floor(Date.now() / 1000)
      const result = await db
        .prepare(
          `SELECT 
            o.id as order_id, 
            o.borrower,
            o.order_data,
            o.borrower_signature,
            o.nonce as order_nonce,
            oo.id as offer_id,
            oo.lender,
            oo.bps,
            oo.lender_signature,
            oo.nonce as offer_nonce
           FROM orders o
           JOIN order_offers oo ON oo.order_id = o.id
           WHERE o.status = 'matched'
             AND oo.status = 'pending'
             AND o.deadline > ?
           ORDER BY CAST(json_extract(o.order_data, '$.duration') AS INTEGER) ASC, o.created_at ASC
           LIMIT 50`
        )
        .bind(now)
        .all<Record<string, unknown>>()
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

    /**
     * After settling an order, expire all other pending orders from the same borrower
     * with the same nonce (that nonce is now consumed on-chain, so they can never settle).
     */
    async expireSiblingOrders(settledOrderId: string, borrower: string, nonce: string): Promise<number> {
      const result = await db
        .prepare(
          `UPDATE orders SET status = 'expired'
           WHERE status = 'pending' AND id != ? AND LOWER(borrower) = LOWER(?) AND nonce = ?`
        )
        .bind(settledOrderId, normalizeAddress(borrower), nonce)
        .run()
      return (result.meta?.changes as number) ?? 0
    },

    async getPendingOrders(): Promise<Record<string, unknown>[]> {
      const result = await db
        .prepare(`SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`)
        .all<Record<string, unknown>>()
      return result.results
    },

    // -----------------------------------------------------------------------
    // Pair aggregation
    // -----------------------------------------------------------------------

    async getPairAggregates(): Promise<PairAggregate[]> {
      // Query 1: all inscriptions grouped by (debt_token, collateral_token)
      const allResult = await db
        .prepare(
          `SELECT
            d.asset_address AS debt_token,
            c.asset_address AS collateral_token,
            COUNT(DISTINCT i.id) AS total_count,
            SUM(CAST(d.value AS REAL)) AS total_volume
           FROM inscriptions i
           JOIN inscription_assets d
             ON d.inscription_id = i.id AND d.asset_role = 'debt' AND d.asset_index = 0
           JOIN inscription_assets c
             ON c.inscription_id = i.id AND c.asset_role = 'collateral' AND c.asset_index = 0
           GROUP BY d.asset_address, c.asset_address`
        )
        .all<{ debt_token: string; collateral_token: string; total_count: number; total_volume: number }>()

      // Query 2: open inscriptions only
      const openResult = await db
        .prepare(
          `SELECT
            d.asset_address AS debt_token,
            c.asset_address AS collateral_token,
            COUNT(DISTINCT i.id) AS open_count
           FROM inscriptions i
           JOIN inscription_assets d
             ON d.inscription_id = i.id AND d.asset_role = 'debt' AND d.asset_index = 0
           JOIN inscription_assets c
             ON c.inscription_id = i.id AND c.asset_role = 'collateral' AND c.asset_index = 0
           WHERE i.status = 'open'
           GROUP BY d.asset_address, c.asset_address`
        )
        .all<{ debt_token: string; collateral_token: string; open_count: number }>()

      // Query 3: pending off-chain orders
      const ordersResult = await db
        .prepare(
          `SELECT debt_token, collateral_token, COUNT(*) AS pending_count
           FROM orders
           WHERE status = 'pending'
             AND debt_token IS NOT NULL
             AND collateral_token IS NOT NULL
           GROUP BY debt_token, collateral_token`
        )
        .all<{ debt_token: string; collateral_token: string; pending_count: number }>()

      // Merge results into a single map keyed by "debt_token|collateral_token"
      const pairKey = (d: string, c: string) => `${d.toLowerCase()}|${c.toLowerCase()}`
      const map = new Map<string, PairAggregate>()

      for (const row of allResult.results) {
        const key = pairKey(row.debt_token, row.collateral_token)
        map.set(key, {
          debt_token: row.debt_token,
          collateral_token: row.collateral_token,
          open_count: 0,
          total_count: row.total_count,
          total_volume: String(row.total_volume ?? 0),
          pending_order_count: 0,
        })
      }

      for (const row of openResult.results) {
        const key = pairKey(row.debt_token, row.collateral_token)
        const existing = map.get(key)
        if (existing) {
          existing.open_count = row.open_count
        } else {
          map.set(key, {
            debt_token: row.debt_token,
            collateral_token: row.collateral_token,
            open_count: row.open_count,
            total_count: 0,
            total_volume: '0',
            pending_order_count: 0,
          })
        }
      }

      for (const row of ordersResult.results) {
        const key = pairKey(row.debt_token, row.collateral_token)
        const existing = map.get(key)
        if (existing) {
          existing.pending_order_count = row.pending_count
        } else {
          map.set(key, {
            debt_token: row.debt_token,
            collateral_token: row.collateral_token,
            open_count: 0,
            total_count: 0,
            total_volume: '0',
            pending_order_count: row.pending_count,
          })
        }
      }

      return [...map.values()]
    },

    async getListingsForPair(debtToken: string, collateralToken: string) {
      const normalizedDebt = normalizeAddress(debtToken)
      const normalizedCollateral = normalizeAddress(collateralToken)

      // On-chain inscriptions for this pair (open + filled)
      const inscriptionsResult = await db
        .prepare(
          `SELECT DISTINCT i.*
           FROM inscriptions i
           JOIN inscription_assets d
             ON d.inscription_id = i.id AND d.asset_role = 'debt' AND d.asset_index = 0
           JOIN inscription_assets c
             ON c.inscription_id = i.id AND c.asset_role = 'collateral' AND c.asset_index = 0
           WHERE LOWER(d.asset_address) = LOWER(?)
             AND LOWER(c.asset_address) = LOWER(?)
             AND i.status IN ('open', 'filled', 'partial')
           ORDER BY i.created_at_ts DESC
           LIMIT 100`
        )
        .bind(normalizedDebt, normalizedCollateral)
        .all<Record<string, unknown>>()

      // Fetch assets for those inscriptions
      const ids = inscriptionsResult.results.map((i) => i.id as string)
      let assets: Record<string, unknown>[] = []
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ')
        const assetsResult = await db
          .prepare(
            `SELECT * FROM inscription_assets
             WHERE inscription_id IN (${placeholders})
             ORDER BY inscription_id, asset_role, asset_index`
          )
          .bind(...ids)
          .all<Record<string, unknown>>()
        assets = assetsResult.results
      }

      // Group assets by inscription_id
      const assetMap = new Map<string, Record<string, unknown>[]>()
      for (const asset of assets) {
        const key = asset.inscription_id as string
        if (!assetMap.has(key)) assetMap.set(key, [])
        assetMap.get(key)!.push(asset)
      }

      const inscriptions = inscriptionsResult.results.map((i) => ({
        ...i,
        assets: assetMap.get(i.id as string) ?? [],
      }))

      // Off-chain pending orders for this pair
      const ordersResult = await db
        .prepare(
          `SELECT * FROM orders
           WHERE status = 'pending'
             AND LOWER(debt_token) = LOWER(?)
             AND LOWER(collateral_token) = LOWER(?)
           ORDER BY created_at DESC
           LIMIT 100`
        )
        .bind(normalizedDebt, normalizedCollateral)
        .all<Record<string, unknown>>()

      return {
        inscriptions,
        orders: ordersResult.results,
      }
    },
  }
}

export type D1Queries = ReturnType<typeof createD1Queries>
