/** Sliding-window IP-based rate limiter (in-memory) */

interface WindowEntry {
  timestamps: number[]
}

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 60  // 60 requests per window

const store = new Map<string, WindowEntry>()

/** Remove expired entries every 60 seconds */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 60_000)

export function isRateLimited(ip: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now()
  let entry = store.get(ip)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(ip, entry)
  }

  // Slide the window: keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldest = entry.timestamps[0]!
    const retryAfterMs = WINDOW_MS - (now - oldest)
    return { limited: true, retryAfterMs: Math.max(retryAfterMs, 1000) }
  }

  entry.timestamps.push(now)
  return { limited: false, retryAfterMs: 0 }
}
