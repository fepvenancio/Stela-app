import type { WebhookPayload } from '@stela/core'
import type { OrderWebhookEvent } from './transform.js'

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

export interface MatchingEnginePayload {
  events: OrderWebhookEvent[]
}

/** Shared retry loop for posting JSON payloads with Bearer auth. */
async function postWithRetry(
  url: string,
  secret: string,
  body: unknown,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      })

      if (res.ok) return

      const text = await res.text().catch(() => '')
      console.error(`Webhook POST failed (${res.status}): ${text}`)

      // Don't retry 4xx (client errors) except 429 (rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`Webhook rejected: ${res.status} ${text}`)
      }
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err
      console.warn(`Webhook attempt ${attempt + 1} failed, retrying...`)
    }

    // Exponential backoff
    await new Promise((r) => setTimeout(r, INITIAL_BACKOFF_MS * Math.pow(2, attempt)))
  }
}

/** Post inscription events to the CF worker webhook endpoint. */
export async function postWebhook(
  webhookUrl: string,
  webhookSecret: string,
  payload: WebhookPayload,
): Promise<void> {
  const url = `${webhookUrl}/webhook/events`
  await postWithRetry(url, webhookSecret, payload)
}

/** Post order events to the matching engine webhook endpoint. */
export async function postMatchingEngineWebhook(
  webhookUrl: string,
  webhookSecret: string,
  payload: MatchingEnginePayload,
): Promise<void> {
  const url = `${webhookUrl}/webhooks/events`
  await postWithRetry(url, webhookSecret, payload)
}
