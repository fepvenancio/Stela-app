import crypto from 'node:crypto'
import express from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { db } from '../db/queries.js'

const app = express()

const API_KEY = process.env.INDEXER_API_KEY
if (!API_KEY) {
  console.error('INDEXER_API_KEY env var is required')
  process.exit(1)
}

const apiKeyBuffer = Buffer.from(API_KEY)

// Timing-safe API key comparison
app.use((req, res, next) => {
  const provided = req.headers['x-api-key']
  if (typeof provided !== 'string') {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const providedBuffer = Buffer.from(provided)
  if (apiKeyBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(apiKeyBuffer, providedBuffer)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
})

// Wrap async route handlers to catch errors
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

// Input validation
function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

const HEX_PATTERN = /^0x[0-9a-fA-F]{1,64}$/

app.get('/api/inscriptions', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const address = typeof req.query.address === 'string' && HEX_PATTERN.test(req.query.address)
    ? req.query.address : undefined
  const page = clampInt(req.query.page, 1, 1000, 1)
  const limit = clampInt(req.query.limit, 1, 100, 20)

  const inscriptions = await db.getInscriptions({ status, address, page, limit })
  res.json(inscriptions)
}))

app.get('/api/inscriptions/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!HEX_PATTERN.test(id)) {
    res.status(400).json({ error: 'invalid inscription id' })
    return
  }

  const inscription = await db.getInscription(id)
  if (!inscription) {
    res.status(404).json({ error: 'not found' })
    return
  }
  res.json(inscription)
}))

// Global error handler — never leak internal details
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'internal server error' })
})

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'
app.listen(port, host, () => {
  console.log(`Indexer API running on ${host}:${port}`)
})
