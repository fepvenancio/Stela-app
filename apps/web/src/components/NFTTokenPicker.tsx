'use client'

import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ─────────────────────────────────────────────── */

interface NFTItem {
  tokenId: string
  name: string
  image: string
  collection: string
}

interface NFTOwnedResponse {
  data: NFTItem[]
}

interface NFTTokenPickerProps {
  owner: string
  collectionAddress: string
  onSelect: (tokenId: string) => void
  selectedTokenId?: string
}

/* ── Component ─────────────────────────────────────────── */

export function NFTTokenPicker({
  owner,
  collectionAddress,
  onSelect,
  selectedTokenId,
}: NFTTokenPickerProps) {
  const [nfts, setNfts] = useState<NFTItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNFTs = useCallback(async () => {
    if (!owner || !collectionAddress) {
      setNfts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/nft/owned/${encodeURIComponent(owner)}?collection=${encodeURIComponent(collectionAddress)}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as NFTOwnedResponse
      setNfts(json.data ?? [])
    } catch {
      setError('Failed to load NFTs')
      setNfts([])
    } finally {
      setLoading(false)
    }
  }, [owner, collectionAddress])

  useEffect(() => {
    fetchNFTs()
  }, [fetchNFTs])

  /* Loading skeleton */
  if (loading) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
        role="status"
        aria-busy="true"
        aria-label="Loading NFTs"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-edge/20 bg-surface/5 p-2">
            <Skeleton className="aspect-square w-full rounded-lg bg-surface/10" />
            <Skeleton className="h-3 w-16 mt-2 bg-surface/10" />
          </div>
        ))}
        <span className="sr-only">Loading NFTs...</span>
      </div>
    )
  }

  /* Error state */
  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-nova text-xs">{error}</p>
        <button
          type="button"
          onClick={fetchNFTs}
          className="text-[10px] text-star hover:text-star-bright mt-1 cursor-pointer transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  /* Empty state */
  if (nfts.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-dust">No NFTs found in this collection</p>
      </div>
    )
  }

  /* Grid */
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {nfts.map((nft) => {
        const isSelected = selectedTokenId === nft.tokenId
        return (
          <NFTCard
            key={nft.tokenId}
            nft={nft}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

/* ── NFT Card ──────────────────────────────────────────── */

function NFTCard({
  nft,
  isSelected,
  onSelect,
}: {
  nft: NFTItem
  isSelected: boolean
  onSelect: (tokenId: string) => void
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onSelect(nft.tokenId)}
      className={`rounded-lg border p-2 text-left transition-all cursor-pointer ${
        isSelected
          ? 'border-star/60 bg-star/5 ring-1 ring-star/30'
          : 'border-edge/20 bg-surface/5 hover:border-edge/40 hover:bg-surface/10'
      }`}
    >
      {/* Image or fallback */}
      {nft.image && !imgError ? (
        <img
          src={nft.image}
          alt={nft.name || `Token #${nft.tokenId}`}
          className="aspect-square w-full rounded-lg object-cover bg-abyss"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="aspect-square w-full rounded-lg bg-abyss border border-edge/10 flex items-center justify-center">
          <span className="text-dust font-mono text-xs">#{nft.tokenId}</span>
        </div>
      )}

      {/* Label */}
      <div className="mt-1.5 px-0.5">
        <p className="text-[11px] text-chalk font-mono truncate">
          #{nft.tokenId}
        </p>
        {nft.name && (
          <p className="text-[10px] text-dust truncate">{nft.name}</p>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="flex items-center gap-1 mt-1 px-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-star" />
          <span className="text-[9px] text-star uppercase tracking-wider font-bold">Selected</span>
        </div>
      )}
    </button>
  )
}
