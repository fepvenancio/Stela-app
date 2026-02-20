#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Path to the contracts repo build output — adjust if your contracts repo is elsewhere
const contractPath = resolve(root, '..', 'Stela', 'target', 'dev', 'stela_StelaProtocol.contract_class.json')
const outPath = resolve(root, 'packages', 'core', 'src', 'abi', 'stela.json')

try {
  const raw = readFileSync(contractPath, 'utf-8')
  const contract = JSON.parse(raw)
  const abi = contract.abi

  if (!abi) {
    console.error('No ABI found in contract class JSON')
    process.exit(1)
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(abi, null, 2) + '\n')
  console.log(`ABI synced: ${outPath} (${abi.length} entries)`)
} catch (err) {
  console.error('Failed to sync ABI:', err.message)
  process.exit(1)
}
