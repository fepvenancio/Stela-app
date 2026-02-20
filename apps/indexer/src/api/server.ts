import express from 'express'
import { db } from '../db/queries.js'

const app = express()

const API_KEY = process.env.INDEXER_API_KEY
if (!API_KEY) {
  console.error('INDEXER_API_KEY env var is required')
  process.exit(1)
}

// Reject all requests without a valid API key
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
})

app.get('/api/agreements', async (req, res) => {
  const { status, address, page = '1', limit = '20' } = req.query
  const agreements = await db.getAgreements({
    status: status as string | undefined,
    address: address as string | undefined,
    page: Number(page),
    limit: Math.min(Number(limit), 100),
  })
  res.json(agreements)
})

app.get('/api/agreements/:id', async (req, res) => {
  const agreement = await db.getAgreement(req.params.id)
  if (!agreement) {
    res.status(404).json({ error: 'not found' })
    return
  }
  res.json(agreement)
})

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`Indexer API running on port ${port}`)
})
