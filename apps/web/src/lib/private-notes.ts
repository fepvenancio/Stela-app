/**
 * Private notes storage with encryption at rest.
 *
 * Encrypts note data in localStorage using a rotating XOR cipher to prevent:
 * - Automated browser extension scanning for crypto wallet data
 * - Casual DevTools inspection revealing salts and commitments
 *
 * Note: This protects against automated scanning and casual access, NOT against
 * a determined attacker with full JS execution (XSS). True XSS protection
 * requires Content-Security-Policy headers and framework-level safeguards.
 *
 * Format: "ENC1:" prefix + base64(xor(json, key)) — backward-compatible with
 * old plaintext format (auto-migrated on next write).
 */

import type { PrivateNote } from '@/lib/offchain'

const STORAGE_KEY = 'stela_private_notes'

/** Rotating XOR key — prevents pattern-matching of JSON structure and hex values. */
const CIPHER_KEY = new TextEncoder().encode(
  'stela-private-notes-encryption-key-v1-do-not-change',
)

interface StoredNote {
  owner: string
  inscriptionId: string
  shares: string
  salt: string
  commitment: string
  orderId?: string
  createdAt: number
}

// ---------------------------------------------------------------------------
// Cipher helpers
// ---------------------------------------------------------------------------

function xorCipher(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ CIPHER_KEY[i % CIPHER_KEY.length]
  }
  return result
}

function encryptJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const encrypted = xorCipher(bytes)
  return 'ENC1:' + btoa(String.fromCharCode(...encrypted))
}

function decryptStored(stored: string): string {
  if (!stored.startsWith('ENC1:')) return stored // plaintext (backward compat)
  const encrypted = Uint8Array.from(atob(stored.slice(5)), (c) => c.charCodeAt(0))
  const decrypted = xorCipher(encrypted)
  return new TextDecoder().decode(decrypted)
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function noteToStored(note: PrivateNote, orderId?: string): StoredNote {
  return {
    owner: note.owner,
    inscriptionId: note.inscriptionId.toString(),
    shares: note.shares.toString(),
    salt: note.salt,
    commitment: note.commitment,
    orderId,
    createdAt: Date.now(),
  }
}

function storedToNote(stored: StoredNote): PrivateNote & { orderId?: string; createdAt: number } {
  return {
    owner: stored.owner,
    inscriptionId: BigInt(stored.inscriptionId),
    shares: BigInt(stored.shares),
    salt: stored.salt,
    commitment: stored.commitment,
    orderId: stored.orderId,
    createdAt: stored.createdAt,
  }
}

// ---------------------------------------------------------------------------
// Storage I/O (encrypted)
// ---------------------------------------------------------------------------

function readAll(): Record<string, StoredNote> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const json = decryptStored(raw)
    return JSON.parse(json) as Record<string, StoredNote>
  } catch {
    return {}
  }
}

function writeAll(notes: Record<string, StoredNote>) {
  const json = JSON.stringify(notes)
  localStorage.setItem(STORAGE_KEY, encryptJson(json))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function savePrivateNote(note: PrivateNote, orderId?: string) {
  const all = readAll()
  const key = note.commitment
  all[key] = noteToStored(note, orderId)
  writeAll(all)
}

export function getPrivateNotes(): (PrivateNote & { orderId?: string; createdAt: number })[] {
  const all = readAll()
  return Object.values(all).map(storedToNote)
}

export function getPrivateNote(commitment: string): (PrivateNote & { orderId?: string; createdAt: number }) | null {
  const all = readAll()
  const stored = all[commitment]
  if (!stored) return null
  return storedToNote(stored)
}

export function deletePrivateNote(commitment: string) {
  const all = readAll()
  delete all[commitment]
  writeAll(all)
}

export function exportNotesAsJSON() {
  const notes = getPrivateNotes()
  const blob = new Blob([JSON.stringify(notes, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stela-private-notes-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
