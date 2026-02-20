import 'server-only'

function getEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} env var is required`)
  return val
}

export async function indexerFetch(path: string): Promise<Response> {
  const baseUrl = getEnv('INDEXER_URL')
  const apiKey = getEnv('INDEXER_API_KEY')
  const url = new URL(path, baseUrl)
  return fetch(url, {
    headers: { 'x-api-key': apiKey },
  })
}
