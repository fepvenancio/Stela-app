import cron from 'node-cron'
import { findLiquidatable } from './query.js'
import { liquidate } from './liquidate.js'

console.log('Stela liquidation bot started')

cron.schedule('*/2 * * * *', async () => {
  const now = Math.floor(Date.now() / 1000)
  console.log(`[${new Date().toISOString()}] Checking for liquidatable agreements...`)

  const candidates = await findLiquidatable(now)

  if (candidates.length === 0) {
    console.log('No liquidatable agreements found')
    return
  }

  console.log(`Found ${candidates.length} candidate(s)`)

  for (const agreement of candidates) {
    try {
      const txHash = await liquidate(agreement.id)
      console.log(`Liquidated ${agreement.id}: ${txHash}`)
    } catch (err) {
      console.error(`Failed to liquidate ${agreement.id}:`, err)
    }
  }
})
