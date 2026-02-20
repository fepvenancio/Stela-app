// Server-side only — calls the indexer API with the secret key.
// This file must only be imported from API routes / server components.

const INDEXER_URL = process.env.INDEXER_URL
const INDEXER_API_KEY = process.env.INDEXER_API_KEY

if (!INDEXER_URL || !INDEXER_API_KEY) {
  console.warn('INDEXER_URL and INDEXER_API_KEY must be set for API proxy routes')
}

export async function indexerFetch(path: string): Promise<Response> {
  return fetch(`${INDEXER_URL}${path}`, {
    headers: { 'x-api-key': INDEXER_API_KEY! },
  })
}
