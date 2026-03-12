'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useCountdown } from '@/hooks/useCountdown'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useInscription } from '@/hooks/useInscription'
import { useInscriptionAssets } from '@/hooks/useInscriptionAssets'
import { useShares } from '@/hooks/useShares'
import { InscriptionActions } from '@/components/InscriptionActions'
import { AssetBadge } from '@/components/AssetBadge'
import { InterestAccrualDisplay } from '@/components/InterestAccrualDisplay'
import { TransferSharesModal } from '@/components/TransferSharesModal'
import { computeStatus, enrichStatus } from '@/lib/status'
import { AuctionTimer } from '@/components/AuctionTimer'
import { AuctionPrice } from '@/components/AuctionPrice'
import { GRACE_PERIOD, AUCTION_DURATION } from '@/lib/offchain'
import { formatAddress, addressesEqual } from '@/lib/address'
import { findTokenByAddress, STATUS_LABELS } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/CopyButton'

// ── T1 Data Sections ─────────────────────────────────────────────

/** Extract the data array from an API list response ({ data: [...] }) or raw array */
function extractDataArray(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json as Array<Record<string, unknown>>
  if (json && typeof json === 'object' && 'data' in json && Array.isArray((json as Record<string, unknown>).data)) {
    return (json as Record<string, unknown>).data as Array<Record<string, unknown>>
  }
  return []
}

/** Fetch a T1 list endpoint and refresh on stela:sync events */
function useT1List(endpoint: string) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function fetchData() {
      fetch(endpoint)
        .then(r => r.ok ? r.json() : [])
        .then(data => setItems(extractDataArray(data)))
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    fetchData()

    const onSync = () => fetchData()
    window.addEventListener('stela:sync', onSync)
    return () => window.removeEventListener('stela:sync', onSync)
  }, [endpoint])

  return { items, loading }
}

interface T1SectionProps {
  inscriptionId: string
  title: string
  endpoint: string
  renderRow: (item: Record<string, unknown>, index: number) => React.ReactNode
}

function T1Section({ inscriptionId, title, endpoint, renderRow }: T1SectionProps) {
  const { items, loading } = useT1List(`${endpoint}?inscription_id=${inscriptionId}`)

  if (loading || items.length === 0) return null

  return (
    <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-edge/20 bg-surface/30">
        <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">{title}</h3>
      </div>
      <div className="p-4 sm:p-6 space-y-3">
        {items.map((item, i) => renderRow(item, i))}
      </div>
    </section>
  )
}

function T1Row({ label, detail, status }: { label: string; detail: string; status: string }) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-2 p-3 bg-abyss/40 rounded-xl border border-edge/10">
      <div className="space-y-1 min-w-0">
        <span className="text-xs text-chalk font-mono truncate block">{label}</span>
        <span className="text-[10px] text-dust block truncate">{detail}</span>
      </div>
      <Badge variant={status as 'pending'} className="rounded-full px-3 py-0.5 text-[10px] uppercase tracking-widest shrink-0">
        {status}
      </Badge>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────

interface InscriptionPageProps {
  params: Promise<{ id: string }>
}

const VALID_HEX_ID = /^0x[0-9a-fA-F]{1,64}$/

export default function InscriptionPage({ params }: InscriptionPageProps) {
  const { id } = use(params)
  const isValidId = VALID_HEX_ID.test(id)
  const { address } = useAccount()
  const { data: inscription, isLoading, error } = useInscription(isValidId ? id : '')
  const { data: assets, isLoading: assetsLoading } = useInscriptionAssets(isValidId ? id : '')
  const { data: sharesRaw } = useShares(isValidId ? id : '')

  const status = useMemo<InscriptionStatus>(() => {
    if (!inscription) return 'open'
    return computeStatus(inscription as Parameters<typeof computeStatus>[0])
  }, [inscription])

  const isOwner = useMemo(() => {
    if (!address || !inscription) return false
    const a = inscription as Record<string, unknown>
    const creator = a.creator as string | undefined
    return creator ? addressesEqual(address, creator) : false
  }, [address, inscription])

  const isBorrower = useMemo(() => {
    if (!address || !inscription) return false
    const a = inscription as Record<string, unknown>
    const borrower = a.borrower as string | undefined
    return borrower ? addressesEqual(address, borrower) : false
  }, [address, inscription])

  const shares = useMemo(() => {
    if (!sharesRaw) return 0n
    return BigInt(sharesRaw as string | bigint)
  }, [sharesRaw])

  const a = inscription as Record<string, unknown> | undefined

  const enrichedStatusValue = useMemo(() => {
    if (!a) return status
    return enrichStatus({
      status: String(a.status ?? status),
      signed_at: a.signed_at ? String(a.signed_at) : null,
      duration: String(a.duration ?? '0'),
      issued_debt_percentage: String(a.issued_debt_percentage ?? '0'),
      deadline: String(a.deadline ?? '0'),
      auction_started: a.auction_started ? 1 : 0,
    })
  }, [a, status])

  const [transferModalOpen, setTransferModalOpen] = useState(false)

  const signedAtNum = Number(a?.signed_at ?? 0)
  const durationNum = Number(a?.duration ?? 0)
  const isFilled = signedAtNum > 0
  const isRepaid = Boolean(a?.is_repaid)
  const isLiquidated = Boolean(a?.liquidated)
  const showAccrual = isFilled && !isRepaid && !isLiquidated

  const interestAssetsForAccrual = useMemo(() => {
    if (!assets) return []
    return assets
      .filter((r) => r.asset_role === 'interest')
      .map((r) => ({ address: r.asset_address, value: r.value ?? '0' }))
  }, [assets])

  const maturityTimestamp = useMemo(() => {
    if (!a?.signed_at || Number(a.signed_at as string) <= 0 || !a?.duration) return null
    return Number(a.signed_at as string) + Number(a.duration as string)
  }, [a?.signed_at, a?.duration])
  const countdown = useCountdown(maturityTimestamp)

  // ROI Math
  const roiInfo = useMemo(() => {
    if (!assets) return null
    const debt = assets.filter(r => r.asset_role === 'debt')
    const interest = assets.filter(r => r.asset_role === 'interest')
    
    // Only simple math for single-asset ERC20 for now to keep it clean
    if (debt.length === 1 && interest.length === 1 && debt[0].asset_type === 'ERC20' && interest[0].asset_type === 'ERC20') {
        const debtToken = findTokenByAddress(debt[0].asset_address)
        const intToken = findTokenByAddress(interest[0].asset_address)
        
        if (debtToken && intToken && debtToken.symbol === intToken.symbol) {
            const dVal = BigInt(debt[0].value || '0')
            const iVal = BigInt(interest[0].value || '0')
            if (dVal > 0n) {
                const yieldBps = (iVal * 10000n) / dVal
                const yieldPct = Number(yieldBps) / 100
                return { yieldPct: yieldPct.toFixed(2), symbol: debtToken.symbol }
            }
        }
    }
    return null
  }, [assets])

  if (!isValidId) return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Invalid inscription ID</p><Link href="/markets" className="text-star text-sm hover:underline">Back to Markets</Link></div>
  if (error) return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Failed to load inscription</p><Link href="/markets" className="text-star text-sm hover:underline">Back to Markets</Link></div>

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <Link href="/markets" className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30 self-start sm:self-auto">
          <span className="text-[10px] font-mono text-dust uppercase tracking-widest">ID: {id.slice(0,10)}...</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Data */}
          <section className="bg-surface/20 border border-edge/30 rounded-[32px] p-5 sm:p-8 relative overflow-hidden granite-noise">
             <div className="absolute top-0 right-0 p-4 sm:p-8">
                <Badge variant={status} className="rounded-full px-3 sm:px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                  {STATUS_LABELS[status]}
                </Badge>
             </div>

             <div className="grid sm:grid-cols-2 gap-8 sm:gap-12 pt-8 sm:pt-0">
                <div className="space-y-1">
                   <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Total Reward for Lender</span>
                   {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                     <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-4xl font-display text-star">
                          {roiInfo ? `+${roiInfo.yieldPct}%` : 'Variable'}
                        </span>
                        {roiInfo && <span className="text-dust text-sm">in {roiInfo.symbol}</span>}
                     </div>
                   )}
                   <p className="text-xs text-dust leading-relaxed max-w-[200px] pt-2">
                     Calculated based on the debt vs interest inscription.
                   </p>
                </div>

                <div className="space-y-1">
                   <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Time to Unlock</span>
                   {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                     <div className="flex flex-col">
                        <span className="text-2xl sm:text-4xl font-display text-chalk">
                          {a?.duration ? formatDuration(BigInt(a.duration as string)) : '--'}
                        </span>
                        <span className="text-[10px] text-dust uppercase tracking-widest mt-1">
                          From moment of signing
                        </span>
                     </div>
                   )}
                </div>
             </div>
          </section>

          {/* Specifications Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             {[
               { label: 'Borrower', value: a?.borrower ? formatAddress(a.borrower as string) : '--', mono: true },
               { label: 'Lender', ...(() => {
                 const lender = a?.lender as string | undefined
                 const isFilled = status === 'filled' || status === 'repaid' || status === 'liquidated'
                 if (lender && lender !== '0x0') return { value: formatAddress(lender), mono: true }
                 if (isFilled) return { value: '\u{1F512} Private Lender', mono: false }
                 return { value: a?.multi_lender ? 'Multi-Lender' : 'Waiting...', mono: false }
               })() },
               { label: 'Issued Debt', value: a?.issued_debt_percentage ? `${Number(BigInt(a.issued_debt_percentage as string)) / 100}%` : '0%', mono: false },
             ].map((field, i) => (
               <div key={i} className="bg-abyss/40 border border-edge/20 rounded-2xl p-5">
                  <span className="text-[10px] text-dust uppercase tracking-widest block mb-2">{field.label}</span>
                  <span className={`text-sm text-chalk ${field.mono ? 'font-mono' : 'font-display'}`}>{field.value}</span>
               </div>
             ))}
          </section>

          {/* Assets Table-style view */}
          <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
             <div className="px-4 sm:px-6 py-4 border-b border-edge/20 bg-surface/30">
                <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Inscription Assets</h3>
             </div>
             <div className="p-4 sm:p-6 space-y-8">
                {(['debt', 'interest', 'collateral'] as const).map((role) => {
                  const roleAssets = assets?.filter((r) => r.asset_role === role) ?? []
                  return (
                    <div key={role} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 shrink-0 w-32">
                         <div className={`w-2 h-2 rounded-full ${role === 'debt' ? 'bg-nebula' : role === 'interest' ? 'bg-aurora' : 'bg-star'}`} />
                         <span className="text-[10px] uppercase tracking-[0.2em] text-dust font-bold">{role}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end flex-1">
                        {assetsLoading ? <Skeleton className="h-8 w-24 bg-edge/20" /> : roleAssets.length > 0 ? (
                          roleAssets.map((ra) => {
                            const token = findTokenByAddress(ra.asset_address)
                            const formattedValue = ra.asset_type === 'ERC721' ? undefined : formatTokenValue(ra.value, token?.decimals ?? 18)
                            return (
                              <AssetBadge
                                key={`${ra.asset_role}-${ra.asset_index}`}
                                address={ra.asset_address}
                                assetType={ra.asset_type}
                                value={formattedValue}
                                tokenId={ra.token_id ?? undefined}
                              />
                            )
                          })
                        ) : <span className="text-xs text-dust italic">None</span>}
                      </div>
                    </div>
                  )
                })}
             </div>
          </section>

          {/* Interest Accrual */}
          {showAccrual && interestAssetsForAccrual.length > 0 && (
            <InterestAccrualDisplay
              interestAssets={interestAssetsForAccrual}
              signedAt={signedAtNum}
              duration={durationNum}
            />
          )}

          {/* Auction / Grace Period Info */}
          {(enrichedStatusValue === 'grace_period' || enrichedStatusValue === 'auctioned' || enrichedStatusValue === 'overdue') && (
            <section className="bg-surface/10 border border-edge/20 rounded-3xl p-4 sm:p-6 space-y-4">
              <h3 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Auction Status</h3>
              {enrichedStatusValue === 'grace_period' && signedAtNum > 0 ? (
                <AuctionTimer
                  endTime={signedAtNum + durationNum + Number(GRACE_PERIOD)}
                  label="Grace period ends"
                />
              ) : null}
              {enrichedStatusValue === 'auctioned' && a?.auction_start_time ? (
                <>
                  <AuctionTimer
                    endTime={Number(a.auction_start_time as string) + Number(AUCTION_DURATION)}
                    label="Auction ends"
                  />
                  {(() => {
                    const debtAsset = assets?.find((r) => r.asset_role === 'debt')
                    if (!debtAsset) return null
                    return (
                      <AuctionPrice
                        inscriptionId={BigInt(id)}
                        debtTokenAddress={debtAsset.asset_address}
                        originalDebt={BigInt(debtAsset.value ?? '0')}
                      />
                    )
                  })()}
                </>
              ) : null}
              {enrichedStatusValue === 'overdue' && !a?.auction_started ? (
                <p className="text-sm text-dust">
                  Grace period expired. Anyone can start an auction on this inscription.
                </p>
              ) : null}
            </section>
          )}

          {/* T1: Refinance Offers */}
          {enrichedStatusValue === 'filled' && (
            <T1Section
              inscriptionId={id}
              title="Refinance Offers"
              endpoint="/api/refinances"
              renderRow={(offer, i) => (
                <T1Row
                  key={String(offer.id ?? i)}
                  label={formatAddress(String(offer.new_lender ?? ''))}
                  detail={`Nonce: ${String(offer.nonce ?? '--')}`}
                  status={String(offer.status ?? 'pending')}
                />
              )}
            />
          )}

          {/* T1: Renegotiations */}
          {enrichedStatusValue === 'filled' && (
            <T1Section
              inscriptionId={id}
              title="Renegotiations"
              endpoint="/api/renegotiations"
              renderRow={(p, i) => (
                <T1Row
                  key={String(p.id ?? i)}
                  label={formatAddress(String(p.proposer ?? ''))}
                  detail={p.new_duration ? `New duration: ${p.new_duration}s` : 'New interest terms'}
                  status={String(p.status ?? 'pending')}
                />
              )}
            />
          )}

          {/* T1: Collateral Sales */}
          {(enrichedStatusValue === 'filled' || enrichedStatusValue === 'grace_period') && (
            <T1Section
              inscriptionId={id}
              title="Collateral Sales"
              endpoint="/api/collateral-sales"
              renderRow={(sale, i) => (
                <T1Row
                  key={String(sale.id ?? i)}
                  label={formatAddress(String(sale.buyer ?? ''))}
                  detail={`Min price: ${String(sale.min_price ?? '--')}`}
                  status={String(sale.status ?? 'pending')}
                />
              )}
            />
          )}
        </div>

        {/* Sidebar Actions */}
        <aside className="space-y-6">
          <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden">
             <div className="p-5 sm:p-8 space-y-6">
                <div className="space-y-2">
                   <h3 className="font-display text-lg text-star uppercase tracking-widest">Vault Actions</h3>
                   <p className="text-xs text-dust leading-relaxed">
                     Interact with this inscription. Lenders provide liquidity, Borrowers repay to reclaim collateral.
                   </p>
                </div>
                
                <div className="pt-4 border-t border-star/10">
                   {isLoading ? <Skeleton className="h-24 w-full bg-edge/20" /> : (
                     <InscriptionActions
                       inscriptionId={id}
                       status={status}
                       enrichedStatus={enrichedStatusValue}
                       isOwner={isOwner}
                       isBorrower={isBorrower}
                       shares={shares}
                       multiLender={Boolean(a?.multi_lender)}
                       debtAssets={assets
                         ?.filter((r) => r.asset_role === 'debt')
                         .map((r) => ({ address: r.asset_address, value: r.value ?? '0' })) ?? []}
                       interestAssets={assets
                         ?.filter((r) => r.asset_role === 'interest')
                         .map((r) => ({ address: r.asset_address, value: r.value ?? '0' })) ?? []}
                       debtDecimals={(() => {
                         const da = assets?.filter((r) => r.asset_role === 'debt')
                         const token = da?.[0] ? findTokenByAddress(da[0].asset_address) : undefined
                         return token?.decimals ?? 18
                       })()}
                       wasSigned={Number(a?.signed_at ?? 0) > 0}
                       auctionStarted={Boolean(a?.auction_started)}
                     />
                   )}
                </div>
             </div>
          </Card>

          {/* Detailed Timestamps */}
          <section className="bg-surface/20 border border-edge/20 rounded-3xl p-4 sm:p-6 space-y-4">
             <h4 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Timeline</h4>
             <div className="space-y-4">
                <div className="flex justify-between items-center gap-2">
                   <span className="text-[10px] text-dust uppercase shrink-0">Signed At</span>
                   <span className="text-xs text-chalk font-mono truncate">{a?.signed_at && a.signed_at !== '0' ? formatTimestamp(BigInt(a.signed_at as string)) : 'Unsigned'}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                   <span className="text-[10px] text-dust uppercase shrink-0">Deadline</span>
                   <span className="text-xs text-chalk font-mono truncate">{a?.deadline ? formatTimestamp(BigInt(a.deadline as string)) : '--'}</span>
                </div>
                {maturityTimestamp && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-dust uppercase">Time Remaining</span>
                    <span
                      suppressHydrationWarning
                      className={`text-xs font-mono ${countdown.isExpired ? 'text-nova' : countdown.isUrgent ? 'text-nova' : countdown.isAtRisk ? 'text-star' : 'text-aurora'}`}
                    >
                      {countdown.formatted}
                    </span>
                  </div>
                )}
             </div>
          </section>

          {/* Share Balance */}
          {shares > 0n && (
            <section className="bg-surface/20 border border-edge/20 rounded-3xl p-4 sm:p-6 space-y-4">
              <h4 className="text-star font-mono text-xs uppercase tracking-[0.3em]">Your Shares</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display text-chalk">{shares.toString()}</span>
                <span className="text-xs text-dust">ERC1155</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransferModalOpen(true)}
                className="w-full rounded-xl border-edge/50 text-dust hover:text-star hover:border-star/30 text-[10px] uppercase tracking-widest"
              >
                Transfer Shares
              </Button>
            </section>
          )}
        </aside>

        {/* Transfer Shares Modal */}
        {shares > 0n && (
          <TransferSharesModal
            open={transferModalOpen}
            onOpenChange={setTransferModalOpen}
            inscriptionId={id}
            maxShares={shares}
          />
        )}
      </div>
    </div>
  )
}
