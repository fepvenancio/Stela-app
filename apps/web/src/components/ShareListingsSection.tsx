'use client'

import { useState, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { useShareListings } from '@/hooks/useShareListings'
import { BuyShareModal } from '@/components/BuyShareModal'
import { formatAddress, addressesEqual } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ShareListingsSectionProps {
  inscriptionId: string
}

interface ShareListing {
  id: string
  inscription_id: string
  seller: string
  shares: string
  payment_token: string
  price: string
  status: string
  deadline: number
  created_at: number
  filled_by: string | null
  filled_at: number | null
  tx_hash: string | null
}

export function ShareListingsSection({ inscriptionId }: ShareListingsSectionProps) {
  const { address } = useAccount()
  const { data, isLoading, refetch } = useShareListings({ inscription_id: inscriptionId })
  const [buyListing, setBuyListing] = useState<ShareListing | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const listings = data?.data ?? []

  const handleCancel = useCallback(async (listingId: string) => {
    setCancelling(listingId)
    try {
      const res = await fetch(`/api/share-listings/${listingId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Listing cancelled')
      refetch()
    } catch {
      toast.error('Failed to cancel listing')
    } finally {
      setCancelling(null)
    }
  }, [refetch])

  if (isLoading || listings.length === 0) return null

  const now = Math.floor(Date.now() / 1000)

  return (
    <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-edge/20 bg-surface/30">
        <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Share Listings</h3>
      </div>
      <div className="p-4 sm:p-6 space-y-3">
        {listings.map((listing: ShareListing) => {
          const token = findTokenByAddress(listing.payment_token)
          const symbol = token?.symbol ?? 'TOKEN'
          const decimals = token?.decimals ?? 18
          const expired = listing.deadline < now
          const isSeller = address ? addressesEqual(listing.seller, address) : false

          return (
            <div
              key={listing.id}
              className="flex items-start sm:items-center justify-between gap-2 p-3 bg-abyss/40 rounded-xl border border-edge/10"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-chalk font-mono">{listing.shares} shares</span>
                  <span className="text-[10px] text-dust">@</span>
                  <span className="text-xs text-star font-mono">
                    {formatTokenValue(listing.price, decimals)} {symbol}
                  </span>
                </div>
                <span className="text-[10px] text-dust block">
                  Seller: {formatAddress(listing.seller)}
                  {expired ? ' · Expired' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSeller ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(listing.id)}
                    disabled={cancelling === listing.id}
                    className="text-[10px] uppercase tracking-widest text-nova hover:text-nova border-nova/30 hover:border-nova/50"
                  >
                    {cancelling === listing.id ? 'Cancelling...' : 'Cancel'}
                  </Button>
                ) : !expired && address ? (
                  <Button
                    variant="aurora"
                    size="sm"
                    onClick={() => setBuyListing(listing)}
                    className="text-[10px] uppercase tracking-widest"
                  >
                    Buy
                  </Button>
                ) : null}

                <Badge
                  variant={expired ? 'expired' : ('open' as 'open')}
                  className="rounded-full px-3 py-0.5 text-[10px] uppercase tracking-widest"
                >
                  {expired ? 'expired' : listing.status}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>

      {buyListing && (
        <BuyShareModal
          open={!!buyListing}
          onOpenChange={(open) => { if (!open) setBuyListing(null) }}
          listing={buyListing}
        />
      )}
    </section>
  )
}
