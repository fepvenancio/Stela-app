import type { WebhookPayload } from '@stela/core'

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

export async function postWebhook(
  webhookUrl: string,
  webhookSecret: string,
  payload: WebhookPayload
): Promise<void> {
  const url = `${webhookUrl}/webhook/events`

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) return

      const body = await res.text().catch(() => '')
      console.error(`Webhook POST failed (${res.status}): ${body}`)

      // Don't retry 4xx (client errors) except 429 (rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`Webhook rejected: ${res.status} ${body}`)
      }
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err
      console.warn(`Webhook attempt ${attempt + 1} failed, retrying...`)
    }

    // Exponential backoff
    await new Promise((r) => setTimeout(r, INITIAL_BACKOFF_MS * Math.pow(2, attempt)))
  }
}
