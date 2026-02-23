import { createD1Queries } from '@stela/core'
import type { WebhookPayload } from '@stela/core'
import type { Env } from './types.js'
import { processWebhookEvent } from './handlers/index.js'

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Constant-time string comparison to prevent timing attacks on secret tokens.
 *  Hashes both inputs to fixed-length to avoid leaking length via early return. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  return crypto.subtle.timingSafeEqual(hashA, hashB)
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const queries = createD1Queries(env.DB)

    if (url.pathname === '/health') {
      const lastBlock = await queries.getLastBlock()
      return Response.json({ ok: true, last_block: lastBlock })
    }

    if (url.pathname === '/webhook/events' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null

      if (!token || !(await timingSafeEqual(token, env.WEBHOOK_SECRET))) {
        return new Response('Forbidden', { status: 403 })
      }

      try {
        const payload = (await request.json()) as WebhookPayload

        if (!payload.events || !Array.isArray(payload.events) || payload.events.length > 500) {
          return Response.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
        }

        const lastBlock = await queries.getLastBlock()
        if (payload.block_number <= lastBlock) {
          return Response.json({ ok: true, skipped: true })
        }

        let processedCount = 0
        const errors: string[] = []

        for (const event of payload.events) {
          try {
            await processWebhookEvent(event, queries)
            processedCount++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`Failed to process ${event.event_type} (tx: ${event.tx_hash}):`, msg)
            errors.push(`${event.event_type}:${msg}`)
          }
        }

        if (errors.length > 0) {
          return Response.json({ ok: false, processed: processedCount, failed: errors.length }, { status: 500 })
        }

        await queries.setLastBlock(payload.block_number)
        return Response.json({ ok: true, processed: processedCount })
      } catch (err) {
        console.error('Webhook processing error:', err instanceof Error ? err.message : String(err))
        return Response.json({ ok: false, error: 'Internal processing error' }, { status: 500 })
      }
    }

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const queries = createD1Queries(env.DB)
    const nowSeconds = Math.floor(Date.now() / 1000)
    ctx.waitUntil(
      queries.expireOpenInscriptions(nowSeconds).then((expired) => {
        if (expired > 0) {
          console.log(`Expired ${expired} open inscription(s) past deadline`)
        }
      })
    )
  },
}
