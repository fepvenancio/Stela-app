import type { PrivateNote } from '@/lib/offchain'

const STORAGE_KEY = 'stela_private_notes'

interface StoredNote {
  owner: string
  inscriptionId: string
  shares: string
  salt: string
  commitment: string
  orderId?: string
  createdAt: number
}

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

function readAll(): Record<string, StoredNote> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, StoredNote>
  } catch {
    return {}
  }
}

function writeAll(notes: Record<string, StoredNote>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

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
