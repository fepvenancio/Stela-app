'use client'

import { use, useMemo, useRef } from 'react'
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
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { Badge } from '@/components/ui/badge'
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

/* ── Role-colored asset display ─────────────────────────── */

const ROLE_META = {
  debt: { label: 'Borrow', dot: 'bg-nebula', text: 'text-nebula', bg: 'bg-nebula/8', border: 'border-nebula/20' },
  interest: { label: 'Interest', dot: 'bg-aurora', text: 'text-aurora', bg: 'bg-aurora/8', border: 'border-aurora/20' },
  collateral: { label: 'Collateral', dot: 'bg-star', text: 'text-star', bg: 'bg-star/8', border: 'border-star/20' },
} as const

type AssetRole = keyof typeof ROLE_META

interface DisplayAsset {
  address: string
  type: string
  value?: string
  tokenId?: string
}

function AssetPillDisplay({ asset }: { asset: DisplayAsset }) {
  const token = findTokenByAddress(asset.address)
  const symbol = token?.symbol ?? formatAddress(asset.address)
  const isNft = asset.type === 'ERC721'
  const formatted = isNft
    ? `${symbol}${asset.tokenId && asset.tokenId !== '0' ? ` #${asset.tokenId}` : ''}`
    : `${formatTokenValue(asset.value ?? '0', token?.decimals ?? 18)} ${symbol}`

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/40 border border-edge/25">
      <TokenAvatarByAddress address={asset.address} size={16} />
      <span className="text-xs text-chalk font-medium">{formatted}</span>
    </div>
  )
}

function AssetSection({ role, assets, isLoading }: { role: AssetRole; assets: DisplayAsset[]; isLoading: boolean }) {
  const meta = ROLE_META[role]
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${meta.text}`}>{meta.label}</span>
        {assets.length > 1 && (
          <span className="text-[10px] font-mono text-ash bg-surface/60 px-1.5 py-0.5 rounded-md">{assets.length}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {isLoading ? (
          <Skeleton className="h-8 w-28 rounded-full bg-edge/20" />
        ) : assets.length > 0 ? (
          assets.map((a, i) => <AssetPillDisplay key={`${role}-${i}`} asset={a} />)
        ) : (
          <span className="text-[11px] text-ash/50 italic pl-4">None</span>
        )}
      </div>
    </div>
  )
}

/* ── Order view ──────────────────────────────────────────── */

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

  if (error) return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Failed to load order</p><Link href="/browse" className="text-star text-sm hover:underline">Back to Browse</Link></div>

  const isPending = order?.status === 'pending'
  const hasOffers = (order?.offers?.length ?? 0) > 0

  const toDisplayAssets = (arr: typeof debtAssets): DisplayAsset[] => arr.map(a => ({
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
          <Badge variant="default" className="rounded-full px-3 py-0.5 uppercase tracking-widest text-[9px] font-bold">
            Off-chain
          </Badge>
          <Badge variant={isPending ? 'open' : 'cancelled'} className="rounded-full px-3 py-0.5 uppercase tracking-widest text-[9px] font-bold">
            {order?.status ?? 'Loading'}
          </Badge>
        </>
      }
      roiInfo={roiInfo}
      duration={isLoading ? null : formatDuration(Number(duration))}
      durationLabel="From settlement"
      multiLender={isMultiLender}
      specs={[
        { label: 'Borrower', value: order?.borrower ? formatAddress(order.borrower) : '--', mono: true },
        { label: 'Status', value: order?.status ?? '--', mono: false },
        { label: 'Created', value: order?.created_at ? formatTimestamp(BigInt(order.created_at)) : '--', mono: false },
        { label: 'Deadline', value: order?.deadline ? formatTimestamp(BigInt(order.deadline)) : '--', mono: false },
      ]}
      assets={
        <>
          <AssetSection role="debt" assets={toDisplayAssets(debtAssets)} isLoading={isLoading} />
          <AssetSection role="collateral" assets={toDisplayAssets(collateralAssets)} isLoading={isLoading} />
          <AssetSection role="interest" assets={toDisplayAssets(interestAssets)} isLoading={isLoading} />
        </>
      }
      extraContent={
        hasOffers ? (
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-ash font-bold pl-1">Lending Offers</h3>
            <div className="space-y-2">
              {order?.offers?.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-4 bg-surface/20 border border-edge/20 rounded-2xl">
                  <div>
                    <span className="text-[9px] text-ash uppercase tracking-widest block mb-0.5">Lender</span>
                    <span className="text-sm text-chalk font-mono">{formatAddress(offer.lender)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-ash uppercase tracking-widest block mb-0.5">Share</span>
                    <span className="text-sm text-star font-display">{(offer.bps / 100).toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null
      }
      sidebarTitle="Offer Actions"
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
    />
  )
}

/* ── Inscription view ────────────────────────────────────── */

function InscriptionView({ id }: { id: string }) {
  const { address } = useAccount()
  const { data: inscription, isLoading, error } = useInscription(id)
  const { data: assets, isLoading: assetsLoading } = useInscriptionAssets(id)
  const { data: sharesRaw } = useShares(id)

  const statusRef = useRef<InscriptionStatus>('open')
  const status = useMemo<InscriptionStatus>(() => {
    if (!inscription) return statusRef.current
    const s = computeStatus(inscription as Parameters<typeof computeStatus>[0])
    statusRef.current = s
    return s
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

  if (error) return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Failed to load inscription</p><Link href="/browse" className="text-star text-sm hover:underline">Back to Browse</Link></div>

  const debtAssets = assets?.filter(r => r.asset_role === 'debt') ?? []
  const interestAssets = assets?.filter(r => r.asset_role === 'interest') ?? []
  const collateralAssets = assets?.filter(r => r.asset_role === 'collateral') ?? []

  const toDisplayAssets = (arr: typeof debtAssets): DisplayAsset[] => arr.map(r => ({
    address: r.asset_address, type: r.asset_type, value: r.value ?? '0', tokenId: r.token_id ?? undefined,
  }))

  const lenderDisplay = (() => {
    const lender = a?.lender as string | undefined
    const isFilled = status === 'filled' || status === 'repaid' || status === 'liquidated'
    if (lender && lender !== '0x0') return { value: formatAddress(lender), mono: true }
    if (isFilled) return { value: 'Private Lender', mono: false, isPrivate: true }
    return { value: a?.multi_lender ? 'Multi-Lender' : 'Waiting...', mono: false }
  })()

  return (
    <StelaLayout
      id={id}
      idLabel={`ID: ${id.slice(0, 10)}...`}
      isOwner={isOwner}
      isLoading={isLoading}
      badges={
        <Badge variant={status} className="rounded-full px-3 py-0.5 uppercase tracking-widest text-[9px] font-bold">
          {STATUS_LABELS[status]}
        </Badge>
      }
      roiInfo={roiInfo}
      duration={isLoading ? null : (a?.duration ? formatDuration(BigInt(a.duration as string)) : '--')}
      durationLabel="From signing"
      multiLender={Boolean(a?.multi_lender)}
      specs={[
        { label: 'Borrower', value: a?.borrower ? formatAddress(a.borrower as string) : '--', mono: true },
        { label: 'Lender', value: lenderDisplay.value, mono: lenderDisplay.mono, isPrivate: 'isPrivate' in lenderDisplay },
        { label: 'Issued Debt', value: a?.issued_debt_percentage ? `${Number(BigInt(a.issued_debt_percentage as string)) / 100}%` : '0%', mono: false },
        { label: 'Signed At', value: a?.signed_at && a.signed_at !== '0' ? formatTimestamp(BigInt(a.signed_at as string)) : 'Unsigned', mono: false },
      ]}
      assets={
        <>
          <AssetSection role="debt" assets={toDisplayAssets(debtAssets)} isLoading={assetsLoading} />
          <AssetSection role="collateral" assets={toDisplayAssets(collateralAssets)} isLoading={assetsLoading} />
          <AssetSection role="interest" assets={toDisplayAssets(interestAssets)} isLoading={assetsLoading} />
        </>
      }
      extraContent={null}
      sidebarTitle="Vault Actions"
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
    />
  )
}

/* ── Shared layout ───────────────────────────────────────── */

interface StelaLayoutProps {
  id: string
  idLabel: string
  isOwner: boolean
  isLoading: boolean
  badges: React.ReactNode
  roiInfo: { yieldPct: string; symbol: string } | null
  duration: string | null
  durationLabel: string
  multiLender?: boolean
  specs: { label: string; value: string; mono: boolean; isPrivate?: boolean }[]
  assets: React.ReactNode
  extraContent: React.ReactNode
  sidebarTitle: string
  sidebarActions: React.ReactNode
}

function StelaLayout({
  id, idLabel, isOwner, isLoading, badges, roiInfo, duration, durationLabel,
  multiLender, specs, assets, extraContent, sidebarTitle, sidebarActions,
}: StelaLayoutProps) {
  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <Link href={isOwner ? '/portfolio' : '/browse'} className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {isOwner ? 'Portfolio' : 'Library'}
        </Link>
        <div className="flex items-center gap-2 bg-surface/40 px-3 py-1 rounded-full border border-edge/25">
          <span className="text-[10px] font-mono text-ash uppercase tracking-widest">{idLabel}</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Hero — compact */}
          <section className="bg-surface/15 border border-edge/25 rounded-2xl p-6 relative overflow-hidden granite-noise">
            {/* Status badges */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {badges}
                {multiLender && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-cosmic uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full bg-cosmic/8 border border-cosmic/20">
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-cosmic" aria-hidden="true">
                      <circle cx="4" cy="5" r="2" /><circle cx="10" cy="5" r="2" />
                      <path d="M1 12c0-2 1.5-3 3-3s3 1 3 3" /><path d="M7 12c0-2 1.5-3 3-3s3 1 3 3" />
                    </svg>
                    Multi
                  </span>
                )}
              </div>
            </div>

            {/* Key metrics — 2-col */}
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-1">
                <span className="text-[9px] text-ash uppercase tracking-[0.2em] font-bold">Lender Yield</span>
                {isLoading ? <Skeleton className="h-9 w-28 bg-edge/20" /> : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display text-star">
                      {roiInfo ? `+${roiInfo.yieldPct}%` : 'Variable'}
                    </span>
                    {roiInfo && <span className="text-dust text-xs">in {roiInfo.symbol}</span>}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-ash uppercase tracking-[0.2em] font-bold">Duration</span>
                {isLoading ? <Skeleton className="h-9 w-28 bg-edge/20" /> : (
                  <div>
                    <span className="text-3xl font-display text-chalk">{duration ?? '--'}</span>
                    <span className="text-[9px] text-ash uppercase tracking-widest block mt-0.5">{durationLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Specs — inline chips */}
          <div className="flex flex-wrap gap-2">
            {specs.map((field, i) => (
              <div key={i} className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface/20 border border-edge/20 rounded-xl">
                <span className="text-[9px] text-ash uppercase tracking-widest">{field.label}</span>
                {field.isPrivate ? (
                  <span className="text-xs text-chalk font-display flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-star" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    {field.value}
                  </span>
                ) : (
                  <span className={`text-xs text-chalk ${field.mono ? 'font-mono' : 'font-medium'}`}>{field.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Assets */}
          <section className="bg-surface/10 border border-edge/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-edge/20 bg-surface/25">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-ash font-bold">Assets</h3>
            </div>
            <div className="p-5 space-y-5">
              {assets}
            </div>
          </section>

          {extraContent}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="border border-star/15 bg-star/[0.02] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-star/10">
              <h3 className="font-display text-sm text-star uppercase tracking-[0.2em]">{sidebarTitle}</h3>
            </div>
            <div className="p-6">
              {sidebarActions}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ── Page entry point ────────────────────────────────────── */

export default function StelaPage({ params }: StelaPageProps) {
  const { id } = use(params)
  const idType = detectIdType(id)

  if (idType === 'invalid') {
    return <div className="py-24 text-center"><p className="text-nova text-sm mb-4">Invalid ID format</p><Link href="/browse" className="text-star text-sm hover:underline">Back to Browse</Link></div>
  }

  if (idType === 'order') {
    return <OrderView id={id} />
  }

  return <InscriptionView id={id} />
}
