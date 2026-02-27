/** Sliding-window IP-based rate limiter (in-memory) with per-endpoint limits */

interface WindowEntry {
  timestamps: number[]
}

const WINDOW_MS = 60_000 // 1 minute

/** Limits per window by method type */
const WRITE_MAX = 10   // POST/DELETE: 10 req/min
const READ_MAX = 60    // GET: 60 req/min

/** Max request body size in bytes (50KB) */
export const MAX_BODY_SIZE = 50 * 1024

/** IP-based rate limit stores (separate for reads/writes) */
const readStore = new Map<string, WindowEntry>()
const writeStore = new Map<string, WindowEntry>()

/** Address-based rate limit store for write operations */
const addressStore = new Map<string, WindowEntry>()

/** Remove expired entries every 60 seconds */
setInterval(() => {
  const now = Date.now()
  for (const store of [readStore, writeStore, addressStore]) {
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }
}, 60_000)

function checkWindow(
  store: Map<string, WindowEntry>,
  key: string,
  max: number,
): { limited: boolean; retryAfterMs: number } {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Slide the window: keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]!
    const retryAfterMs = WINDOW_MS - (now - oldest)
    return { limited: true, retryAfterMs: Math.max(retryAfterMs, 1000) }
  }

  entry.timestamps.push(now)
  return { limited: false, retryAfterMs: 0 }
}

export type RateLimitMethod = 'GET' | 'POST' | 'DELETE'

/**
 * Check IP-based rate limit for a request.
 * Write methods (POST/DELETE) get 10 req/min; reads (GET) get 60 req/min.
 */
export function isRateLimited(
  ip: string,
  method: RateLimitMethod = 'GET',
): { limited: boolean; retryAfterMs: number } {
  const isWrite = method === 'POST' || method === 'DELETE'
  const store = isWrite ? writeStore : readStore
  const max = isWrite ? WRITE_MAX : READ_MAX
  return checkWindow(store, ip, max)
}

/**
 * Check address-based rate limit for write operations.
 * Limits a single StarkNet address to WRITE_MAX writes per minute.
 */
export function isAddressRateLimited(
  address: string,
): { limited: boolean; retryAfterMs: number } {
  const normalized = address.replace(/^0x/i, '').toLowerCase()
  return checkWindow(addressStore, normalized, WRITE_MAX)
}
