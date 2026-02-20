import { pool } from './db.js'

export async function findLiquidatable(nowSeconds: number) {
  const result = await pool.query(
    `SELECT id
     FROM agreements
     WHERE status = 'filled'
       AND signed_at IS NOT NULL
       AND (signed_at + duration) < $1
     ORDER BY (signed_at + duration) ASC
     LIMIT 50`,
    [nowSeconds]
  )

  return result.rows as { id: string }[]
}
