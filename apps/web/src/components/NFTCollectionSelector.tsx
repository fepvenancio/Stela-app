'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { getNFTCollections } from '@stela/core'
import { NETWORK } from '@/lib/config'
import { formatAddress } from '@/lib/address'
import { stringToColor } from '@/components/TokenAvatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/* ── Types ────────────────────────────────────────────── */

export interface NFTCollectionInfo {
  address: string
  name: string
  image?: string
  symbol?: string
}

export interface NFTCollectionSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (collection: NFTCollectionInfo) => void
}

/* ── Helpers ──────────────────────────────────────────── */

const knownCollections = getNFTCollections(NETWORK)

interface FetchedMetadata {
  name: string
  symbol: string
  image: string | null
}

/* ── NFT Collection Avatar ────────────────────────────── */

function CollectionAvatar({
  name,
  image,
  size = 40,
}: {
  name: string
  image?: string | null
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const bgColor = stringToColor(name || 'NFT')

  if (image && !imgError) {
    return (
      <div
        className="relative shrink-0 rounded-lg overflow-hidden bg-edge/20"
        style={{ width: size, height: size }}
      >
        <img
          src={image}
          alt={name}
          width={size}
          height={size}
          className="rounded-lg object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 rounded-lg flex items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.35,
      }}
    >
      {(name || 'N').charAt(0).toUpperCase()}
    </div>
  )
}

/* ── Collection Row ───────────────────────────────────── */

function CollectionRow({
  name,
  symbol,
  address,
  image,
  onClick,
}: {
  name: string
  symbol?: string
  address: string
  image?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Select ${name}`}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated/70 transition-colors text-left border border-transparent"
    >
      <CollectionAvatar name={name} image={image} size={40} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-chalk truncate">{name || 'Unknown Collection'}</div>
        <div className="text-xs text-dust">{symbol || formatAddress(address)}</div>
      </div>
      <div className="text-xs text-dust font-mono shrink-0">
        {formatAddress(address)}
      </div>
    </button>
  )
}

/* ── Main Component ───────────────────────────────────── */

export function NFTCollectionSelector({
  open,
  onClose,
  onSelect,
}: NFTCollectionSelectorProps) {
  const [search, setSearch] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchedCollection, setFetchedCollection] = useState<(FetchedMetadata & { address: string }) | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setSearch('')
      setFetchedCollection(null)
      setFetchError(null)
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  const isAddressSearch = search.trim().startsWith('0x') && search.trim().length > 6

  // Auto-fetch metadata when user types an address
  useEffect(() => {
    if (!isAddressSearch) {
      setFetchedCollection(null)
      setFetchError(null)
      return
    }

    const addr = search.trim()

    // Check if it matches a known collection — skip fetch
    const known = knownCollections.find(
      (c) => (c.addresses[NETWORK] ?? '').toLowerCase() === addr.toLowerCase(),
    )
    if (known) {
      setFetchedCollection(null)
      setFetchError(null)
      return
    }

    // Debounce the fetch
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setFetching(true)
      setFetchError(null)

      fetch(`/api/nft/collection/${addr}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status}`)
          return res.json() as Promise<{ data: FetchedMetadata }>
        })
        .then(({ data }) => {
          setFetchedCollection({ ...data, address: addr })
          setFetching(false)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setFetchError('Could not fetch collection metadata')
          setFetching(false)
        })
    }, 400)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [search, isAddressSearch])

  // Filter known collections by search term
  const filteredKnown = useMemo(() => {
    if (!search.trim() || isAddressSearch) return knownCollections
    const q = search.toLowerCase().trim()
    return knownCollections.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    )
  }, [search, isAddressSearch])

  const handleSelect = useCallback(
    (collection: NFTCollectionInfo) => {
      onSelect(collection)
      onClose()
    },
    [onSelect, onClose],
  )

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose()
    },
    [onClose],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="bg-void border-edge/50 text-chalk p-0 gap-0 sm:max-w-md overflow-hidden"
        showCloseButton={true}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-sm tracking-widest text-star uppercase">
            Select Collection
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-3">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name or paste address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-edge text-chalk text-sm placeholder:text-ash outline-none focus:border-star focus:ring-1 focus:ring-star/30 transition-colors"
              aria-label="Search collections"
            />
          </div>
        </div>

        {/* Popular label */}
        {!search && filteredKnown.length > 0 && (
          <div className="px-5 pt-3">
            <span className="text-[10px] uppercase tracking-widest font-bold text-dust">Popular</span>
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 mt-3 border-t border-edge" />

        {/* Collection List */}
        <div className="overflow-y-auto max-h-[340px] px-2 py-2 space-y-0.5">
          {/* Known collections */}
          {filteredKnown.map((c) => {
            const addr = c.addresses[NETWORK] ?? ''
            return (
              <CollectionRow
                key={addr}
                name={c.name}
                symbol={c.symbol}
                address={addr}
                image={c.logoUrl}
                onClick={() =>
                  handleSelect({
                    address: addr,
                    name: c.name,
                    image: c.logoUrl,
                    symbol: c.symbol,
                  })
                }
              />
            )
          })}

          {/* Fetched collection from address search */}
          {fetchedCollection && (
            <>
              {filteredKnown.length > 0 && (
                <div className="mx-3 my-1 border-t border-edge/50" />
              )}
              <CollectionRow
                name={fetchedCollection.name}
                symbol={fetchedCollection.symbol}
                address={fetchedCollection.address}
                image={fetchedCollection.image}
                onClick={() =>
                  handleSelect({
                    address: fetchedCollection.address,
                    name: fetchedCollection.name,
                    image: fetchedCollection.image ?? undefined,
                    symbol: fetchedCollection.symbol,
                  })
                }
              />
            </>
          )}

          {/* Loading state */}
          {fetching && (
            <div className="flex items-center justify-center py-6 gap-2">
              <svg className="animate-spin h-4 w-4 text-star" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-dust">Fetching collection...</span>
            </div>
          )}

          {/* Fetch error */}
          {fetchError && !fetching && (
            <div className="text-center py-6 text-dust text-sm">
              {fetchError}
            </div>
          )}

          {/* Empty state */}
          {filteredKnown.length === 0 && !fetchedCollection && !fetching && !fetchError && (
            <div className="text-center py-8 text-dust text-sm">
              {search.trim()
                ? isAddressSearch
                  ? 'Paste a full contract address to look it up'
                  : 'No collections found'
                : 'No collections available'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
