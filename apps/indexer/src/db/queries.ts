import pg from 'pg'
import type { InscriptionStatus } from '@stela/core'
import { VALID_STATUSES } from '@stela/core'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

// Allowlisted columns for inscription upserts — prevents SQL injection
const INSCRIPTION_COLUMNS = new Set([
  'id', 'creator', 'borrower', 'lender', 'status',
  'issued_debt_percentage', 'multi_lender', 'duration', 'deadline',
  'signed_at', 'debt_asset_count', 'interest_asset_count',
  'collateral_asset_count', 'created_at_block', 'created_at_ts', 'updated_at_ts',
])

interface GetInscriptionsParams {
  status?: string
  address?: string
  page: number
  limit: number
}

function isValidStatus(s: string): s is InscriptionStatus {
  return (VALID_STATUSES as readonly string[]).includes(s)
}

export const db = {
  async getInscriptions({ status, address, page, limit }: GetInscriptionsParams) {
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (status && isValidStatus(status)) {
      conditions.push(`status = $${idx++}`)
      params.push(status)
    }

    if (address) {
      conditions.push(`(creator = $${idx} OR borrower = $${idx} OR lender = $${idx})`)
      params.push(address)
      idx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * limit

    const result = await pool.query(
      `SELECT * FROM inscriptions ${where} ORDER BY created_at_ts DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    return result.rows
  },

  async getInscription(id: string) {
    const result = await pool.query('SELECT * FROM inscriptions WHERE id = $1', [id])
    return result.rows[0] ?? null
  },

  async upsertInscription(inscription: Record<string, unknown>) {
    const keys: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(inscription)) {
      if (!INSCRIPTION_COLUMNS.has(key)) continue
      keys.push(key)
      values.push(val)
    }

    if (keys.length === 0 || !keys.includes('id')) return

    const placeholders = keys.map((_, i) => `$${i + 1}`)
    const updates = keys
      .filter((k) => k !== 'id')
      .map((k) => `"${k}" = EXCLUDED."${k}"`)

    await pool.query(
      `INSERT INTO inscriptions (${keys.map((k) => `"${k}"`).join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
      values
    )
  },

  async insertEvent(event: {
    inscription_id: string
    event_type: string
    tx_hash: string
    block_number: bigint
    timestamp?: bigint
    data?: Record<string, unknown>
  }) {
    await pool.query(
      `INSERT INTO inscription_events (inscription_id, event_type, tx_hash, block_number, timestamp, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.inscription_id, event.event_type, event.tx_hash, event.block_number, event.timestamp ?? null, event.data ? JSON.stringify(event.data) : null]
    )
  },

  async updateInscriptionStatus(id: string, status: string, updatedAt: bigint) {
    await pool.query(
      'UPDATE inscriptions SET status = $1, updated_at_ts = $2 WHERE id = $3',
      [status, updatedAt, id]
    )
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
    await pool.query(
      `INSERT INTO inscription_assets (inscription_id, asset_role, asset_index, asset_address, asset_type, value, token_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (inscription_id, asset_role, asset_index) DO NOTHING`,
      [asset.inscription_id, asset.asset_role, asset.asset_index, asset.asset_address, asset.asset_type, asset.value ?? null, asset.token_id ?? null]
    )
  },

  pool,
}
