import './config.js' // validates env vars on startup
import cron from 'node-cron'
import { findLiquidatable } from './query.js'
import { liquidate } from './liquidate.js'

let running = false

console.log('Stela liquidation bot started')

const task = cron.schedule('*/2 * * * *', async () => {
  if (running) {
    console.log('Previous tick still running, skipping')
    return
  }
  running = true

  try {
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
  } catch (err) {
    console.error('Error during liquidation check:', err)
  } finally {
    running = false
  }
})

// Graceful shutdown
function shutdown() {
  console.log('Shutting down bot...')
  task.stop()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
