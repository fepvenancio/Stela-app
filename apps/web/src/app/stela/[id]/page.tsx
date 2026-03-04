'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { findTokenByAddress, STATUS_LABELS } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'
import { useOrder } from '@/hooks/useOrders'
import { useInscription } from '@/hooks/useInscription'
import { useInscriptionAssets } from '@/hooks/useInscriptionAssets'
import { useShares } from '@/hooks/useShares'
import { computeStatus } from '@/lib/status'
import { formatAddress, addressesEqual } from '@/lib/address'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { normalizeOrderData, type RawOrderData } from '@/lib/order-utils'
import { InscriptionActions } from '@/components/InscriptionActions'
import { OrderActions } from '@/components/OrderActions'
import { AssetBadge } from '@/components/AssetBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/CopyButton'

interface StelaPageProps {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_HEX_ID = /^0x[0-9a-fA-F]{1,64}$/

type IdType = 'order' | 'inscription' | 'invalid'

function detectIdType(id: string): IdType {
  if (UUID_RE.test(id)) return 'order'
  if (VALID_HEX_ID.test(id)) return 'inscription'
  return 'invalid'
}

// ── Asset display row ────────────────────────────────────────────────

interface AssetDisplayProps {
  role: 'debt' | 'interest' | 'collateral'
  assets: { address: string; type: string; value?: string; tokenId?: string }[]
  isLoading: boolean
}

function AssetDisplay({ role, assets, isLoading }: AssetDisplayProps) {
  const dotColor = role === 'debt' ? 'bg-star' : role === 'interest' ? 'bg-aurora' : 'bg-nebula'
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 shrink-0 w-32">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-ash font-bold">{role}</span>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end flex-1">
        {isLoading ? <Skeleton className="h-8 w-24 bg-edge/20" /> : assets.length > 0 ? (
          assets.map((a, idx) => {
            const token = findTokenByAddress(a.address)
            const formattedValue = a.type === 'ERC721' ? undefined : formatTokenValue(a.value ?? '0', token?.decimals ?? 18)
            return (
              <AssetBadge
                key={`${role}-${idx}`}
                address={a.address}
                assetType={a.type}
                value={formattedValue}
                tokenId={a.tokenId && a.tokenId !== '0' ? a.tokenId : undefined}
              />
            )
          })
        ) : <span className="text-xs text-ash italic">None</span>}
      </div>
    </div>
  )
}

// ── Order view ──────────────────────────────────────────────────────

function OrderView({ id }: { id: string }) {
  const { address } = useAccount()
  const { data: order, isLoading, error } = useOrder(id)

  const orderData = useMemo(() => {
    if (!order?.order_data) return normalizeOrderData({})
    const raw: RawOrderData = typeof order.order_data === 'string'
      ? (() => { try { return JSON.parse(order.order_data) } catch { return {} } })()
      : order.order_data as unknown as RawOrderData
    return normalizeOrderData(raw)
  }, [order?.order_data])

  const isOwner = useMemo(() => {
    if (!address || !order?.borrower) return false
    return addressesEqual(address, order.borrower)
  }, [address, order?.borrower])

  const { debtAssets, interestAssets, collateralAssets, duration, multiLender: isMultiLender } = orderData

  const roiInfo = useMemo(() => {
    if (debtAssets.length === 1 && interestAssets.length === 1 &&
        debtAssets[0].asset_type === 'ERC20' && interestAssets[0].asset_type === 'ERC20') {
      const debtToken = findTokenByAddress(debtAssets[0].asset_address)
      const intToken = findTokenByAddress(interestAssets[0].asset_address)
      if (debtToken && intToken && debtToken.symbol === intToken.symbol) {
        const dVal = BigInt(debtAssets[0].value || '0')
        const iVal = BigInt(interestAssets[0].value || '0')
        if (dVal > 0n) {
          const yieldBps = (iVal * 10000n) / dVal
          return { yieldPct: (Number(yieldBps) / 100).toFixed(2), symbol: debtToken.symbol }
        }
      }
    }
    return null
  }, [debtAssets, interestAssets])

  if (error) return <div className="py-24 text-center text-nova">Failed to load order</div>

  const isPending = order?.status === 'pending'
  const hasOffers = (order?.offers?.length ?? 0) > 0

  // Normalize assets for AssetDisplay
  const toDisplayAssets = (arr: typeof debtAssets) => arr.map(a => ({
    address: a.asset_address, type: a.asset_type, value: a.value, tokenId: a.token_id,
  }))

  return (
    <StelaLayout
      id={id}
      idLabel={`Order: ${id.slice(0, 8)}...`}
      isOwner={isOwner}
      isLoading={isLoading}
      badges={
        <>
          <Badge variant="default" className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
            Off-chain
          </Badge>
          <Badge variant={isPending ? 'open' : 'cancelled'} className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
            {order?.status ?? 'Loading'}
          </Badge>
        </>
      }
      roiInfo={roiInfo}
      duration={isLoading ? null : formatDuration(Number(duration))}
      durationLabel="From moment of settlement"
      specs={[
        { label: 'Borrower', value: order?.borrower ? formatAddress(order.borrower) : '--', mono: true },
        { label: 'Status', value: order?.status ?? '--', mono: false },
        { label: 'Type', value: isMultiLender ? 'Multi-Lender' : 'Single-Lender', mono: false },
      ]}
      assets={
        <>
          <AssetDisplay role="debt" assets={toDisplayAssets(debtAssets)} isLoading={isLoading} />
          <AssetDisplay role="interest" assets={toDisplayAssets(interestAssets)} isLoading={isLoading} />
          <AssetDisplay role="collateral" assets={toDisplayAssets(collateralAssets)} isLoading={isLoading} />
        </>
      }
      extraContent={
        hasOffers ? (
          <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
              <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Lending Offers</h3>
            </div>
            <div className="p-6 space-y-3">
              {order?.offers?.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-4 bg-abyss/40 border border-edge/20 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-ash uppercase tracking-widest block">Lender</span>
                    {offer.lender_commitment && offer.lender_commitment !== '0x0' && offer.lender_commitment !== '0' ? (
                      <span className="text-sm text-chalk font-display flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-star" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        Private Lender
                      </span>
                    ) : (
                      <span className="text-sm text-chalk font-mono">{formatAddress(offer.lender)}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-ash uppercase tracking-widest block">Percentage</span>
                    <span className="text-sm text-star font-display">{(offer.bps / 100).toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null
      }
      sidebarTitle="Offer Actions"
      sidebarDescription={null}
      sidebarActions={
        isLoading ? <Skeleton className="h-24 w-full bg-edge/20" /> : (
          <OrderActions
            orderId={id}
            status={order?.status ?? 'cancelled'}
            borrower={order?.borrower ?? ''}
            debtAssets={debtAssets}
            multiLender={isMultiLender}
            offers={order?.offers}
          />
        )
      }
      timeline={[
        { label: 'Created', value: order?.created_at ? formatTimestamp(BigInt(order.created_at)) : '--' },
        { label: 'Deadline', value: order?.deadline ? formatTimestamp(BigInt(order.deadline)) : '--' },
      ]}
    />
  )
}

// ── Inscription view ────────────────────────────────────────────────

function InscriptionView({ id }: { id: string }) {
  const { address } = useAccount()
  const { data: inscription, isLoading, error } = useInscription(id)
  const { data: assets, isLoading: assetsLoading } = useInscriptionAssets(id)
  const { data: sharesRaw } = useShares(id)

  const status = useMemo<InscriptionStatus>(() => {
    if (!inscription) return 'open'
    return computeStatus(inscription as Parameters<typeof computeStatus>[0])
  }, [inscription])

  const a = inscription as Record<string, unknown> | undefined

  const isOwner = useMemo(() => {
    if (!address || !a) return false
    const creator = a.creator as string | undefined
    return creator ? addressesEqual(address, creator) : false
  }, [address, a])

  const isBorrower = useMemo(() => {
    if (!address || !a) return false
    const borrower = a.borrower as string | undefined
    return borrower ? addressesEqual(address, borrower) : false
  }, [address, a])

  const shares = useMemo(() => {
    if (!sharesRaw) return 0n
    return BigInt(sharesRaw as string | bigint)
  }, [sharesRaw])

  const roiInfo = useMemo(() => {
    if (!assets) return null
    const debt = assets.filter(x => x.asset_role === 'debt')
    const interest = assets.filter(x => x.asset_role === 'interest')
    if (debt.length === 1 && interest.length === 1 && debt[0].asset_type === 'ERC20' && interest[0].asset_type === 'ERC20') {
      const debtToken = findTokenByAddress(debt[0].asset_address)
      const intToken = findTokenByAddress(interest[0].asset_address)
      if (debtToken && intToken && debtToken.symbol === intToken.symbol) {
        const dVal = BigInt(debt[0].value || '0')
        const iVal = BigInt(interest[0].value || '0')
        if (dVal > 0n) {
          const yieldBps = (iVal * 10000n) / dVal
          return { yieldPct: (Number(yieldBps) / 100).toFixed(2), symbol: debtToken.symbol }
        }
      }
    }
    return null
  }, [assets])

  if (error) return <div className="py-24 text-center text-nova">Failed to load inscription</div>

  const debtAssets = assets?.filter(r => r.asset_role === 'debt') ?? []
  const interestAssets = assets?.filter(r => r.asset_role === 'interest') ?? []
  const collateralAssets = assets?.filter(r => r.asset_role === 'collateral') ?? []

  const toDisplayAssets = (arr: typeof debtAssets) => arr.map(r => ({
    address: r.asset_address, type: r.asset_type, value: r.value ?? '0', tokenId: r.token_id ?? undefined,
  }))

  const lenderDisplay = (() => {
    const lender = a?.lender as string | undefined
    const isFilled = status === 'filled' || status === 'repaid' || status === 'liquidated'
    if (lender && lender !== '0x0') return { value: formatAddress(lender), mono: true }
    if (isFilled) return { value: '\u{1F512} Private Lender', mono: false }
    return { value: a?.multi_lender ? 'Multi-Lender' : 'Waiting...', mono: false }
  })()

  return (
    <StelaLayout
      id={id}
      idLabel={`ID: ${id.slice(0, 10)}...`}
      isOwner={isOwner}
      isLoading={isLoading}
      badges={
        <Badge variant={status} className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
          {STATUS_LABELS[status]}
        </Badge>
      }
      roiInfo={roiInfo}
      duration={isLoading ? null : (a?.duration ? formatDuration(BigInt(a.duration as string)) : '--')}
      durationLabel="From moment of signing"
      specs={[
        { label: 'Borrower', value: a?.borrower ? formatAddress(a.borrower as string) : '--', mono: true },
        { label: 'Lender', ...lenderDisplay },
        { label: 'Issued Debt', value: a?.issued_debt_percentage ? `${Number(BigInt(a.issued_debt_percentage as string)) / 100}%` : '0%', mono: false },
      ]}
      assets={
        <>
          <AssetDisplay role="debt" assets={toDisplayAssets(debtAssets)} isLoading={assetsLoading} />
          <AssetDisplay role="interest" assets={toDisplayAssets(interestAssets)} isLoading={assetsLoading} />
          <AssetDisplay role="collateral" assets={toDisplayAssets(collateralAssets)} isLoading={assetsLoading} />
        </>
      }
      extraContent={null}
      sidebarTitle="Vault Actions"
      sidebarDescription="Interact with this inscription. Lenders provide liquidity, Borrowers repay to reclaim collateral."
      sidebarActions={
        isLoading ? <Skeleton className="h-24 w-full bg-edge/20" /> : (
          <InscriptionActions
            inscriptionId={id}
            status={status}
            isOwner={isOwner}
            isBorrower={isBorrower}
            shares={shares}
            multiLender={Boolean(a?.multi_lender)}
            debtAssets={debtAssets.map(r => ({ address: r.asset_address, value: r.value ?? '0' }))}
            interestAssets={interestAssets.map(r => ({ address: r.asset_address, value: r.value ?? '0' }))}
            debtDecimals={(() => {
              const token = debtAssets[0] ? findTokenByAddress(debtAssets[0].asset_address) : undefined
              return token?.decimals ?? 18
            })()}
            wasSigned={Number(a?.signed_at ?? 0) > 0}
          />
        )
      }
      timeline={[
        { label: 'Signed At', value: a?.signed_at && a.signed_at !== '0' ? formatTimestamp(BigInt(a.signed_at as string)) : 'Unsigned' },
        { label: 'Deadline', value: a?.deadline ? formatTimestamp(BigInt(a.deadline as string)) : '--' },
      ]}
    />
  )
}

// ── Shared layout ───────────────────────────────────────────────────

interface StelaLayoutProps {
  id: string
  idLabel: string
  isOwner: boolean
  isLoading: boolean
  badges: React.ReactNode
  roiInfo: { yieldPct: string; symbol: string } | null
  duration: string | null
  durationLabel: string
  specs: { label: string; value: string; mono: boolean }[]
  assets: React.ReactNode
  extraContent: React.ReactNode
  sidebarTitle: string
  sidebarDescription: string | null
  sidebarActions: React.ReactNode
  timeline: { label: string; value: string }[]
}

function StelaLayout({
  id, idLabel, isOwner, isLoading, badges, roiInfo, duration, durationLabel,
  specs, assets, extraContent, sidebarTitle, sidebarDescription, sidebarActions, timeline,
}: StelaLayoutProps) {
  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        <Link href={isOwner ? '/portfolio' : '/browse'} className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {isOwner ? 'Back to Portfolio' : 'Back to Library'}
        </Link>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30">
          <span className="text-[10px] font-mono text-ash uppercase tracking-widest">{idLabel}</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero */}
          <section className="bg-surface/20 border border-edge/30 rounded-[32px] p-8 relative overflow-hidden granite-noise">
            <div className="flex flex-wrap gap-2 justify-end mb-4">
              {badges}
            </div>
            <div className="grid sm:grid-cols-2 gap-12">
              <div className="space-y-1">
                <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Total Reward for Lender</span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display text-star">
                      {roiInfo ? `+${roiInfo.yieldPct}%` : 'Variable'}
                    </span>
                    {roiInfo && <span className="text-dust text-sm">in {roiInfo.symbol}</span>}
                  </div>
                )}
                <p className="text-xs text-ash leading-relaxed max-w-[200px] pt-2">
                  Calculated based on the debt vs interest inscription.
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">
                  {duration === null ? 'Loan Duration' : 'Time to Unlock'}
                </span>
                {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                  <div className="flex flex-col">
                    <span className="text-4xl font-display text-chalk">{duration ?? '--'}</span>
                    <span className="text-[10px] text-ash uppercase tracking-widest mt-1">{durationLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Specs Grid */}
          <section className="grid sm:grid-cols-3 gap-4">
            {specs.map((field, i) => (
              <div key={i} className="bg-abyss/40 border border-edge/20 rounded-2xl p-5">
                <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">{field.label}</span>
                <span className={`text-sm text-chalk ${field.mono ? 'font-mono' : 'font-display'} capitalize`}>{field.value}</span>
              </div>
            ))}
          </section>

          {/* Assets */}
          <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
              <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Assets</h3>
            </div>
            <div className="p-6 space-y-8">
              {assets}
            </div>
          </section>

          {extraContent}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="font-display text-lg text-star uppercase tracking-widest">{sidebarTitle}</h3>
                {sidebarDescription && (
                  <p className="text-xs text-dust leading-relaxed">{sidebarDescription}</p>
                )}
              </div>
              <div className="pt-4 border-t border-star/10">
                {sidebarActions}
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <section className="bg-surface/20 border border-edge/20 rounded-3xl p-6 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-ash font-bold">Timeline</h4>
            <div className="space-y-4">
              {timeline.map((entry, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[10px] text-dust uppercase">{entry.label}</span>
                  <span className="text-xs text-chalk font-mono">{entry.value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

// ── Page entry point ────────────────────────────────────────────────

export default function StelaPage({ params }: StelaPageProps) {
  const { id } = use(params)
  const idType = detectIdType(id)

  if (idType === 'invalid') {
    return <div className="py-24 text-center text-nova">Invalid ID format</div>
  }

  if (idType === 'order') {
    return <OrderView id={id} />
  }

  return <InscriptionView id={id} />
}
