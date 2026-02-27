import { createD1Queries } from '@stela/core'
import type { Env } from './types.js'
import { processWebhookEvent } from './handlers/index.js'
import { webhookPayloadSchema } from './schemas.js'

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Constant-time string comparison to prevent timing attacks on secret tokens. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  return crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b))
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

      if (!token || !timingSafeEqual(token, env.WEBHOOK_SECRET)) {
        return new Response('Forbidden', { status: 403 })
      }

      try {
        const raw = await request.json()
        const result = webhookPayloadSchema.safeParse(raw)
        if (!result.success) {
          return Response.json({ ok: false, error: 'Invalid payload', details: result.error.issues }, { status: 400 })
        }
        const payload = result.data

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
