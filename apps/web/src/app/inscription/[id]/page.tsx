'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useInscription } from '@/hooks/useInscription'
import { useInscriptionAssets } from '@/hooks/useInscriptionAssets'
import { useShares } from '@/hooks/useShares'
import { InscriptionActions } from '@/components/InscriptionActions'
import { AssetBadge } from '@/components/AssetBadge'
import { computeStatus } from '@/lib/status'
import { formatAddress, addressesEqual } from '@/lib/address'
import { findTokenByAddress, STATUS_LABELS } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/CopyButton'

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

  // ROI Math
  const roiInfo = useMemo(() => {
    if (!assets) return null
    const debt = assets.filter(a => a.asset_role === 'debt')
    const interest = assets.filter(a => a.asset_role === 'interest')
    
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

  if (!isValidId) return <div className="py-24 text-center text-nova">Invalid ID</div>
  if (error) return <div className="py-24 text-center text-nova">Failed to load inscription</div>

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/browse" className="text-ash hover:text-star transition-colors text-sm flex items-center gap-2 group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30">
          <span className="text-[10px] font-mono text-ash uppercase tracking-widest">ID: {id.slice(0,10)}...</span>
          <CopyButton value={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Data */}
          <section className="bg-surface/20 border border-edge/30 rounded-[32px] p-8 relative overflow-hidden granite-noise">
             <div className="absolute top-0 right-0 p-8">
                <Badge variant={status} className="rounded-full px-4 py-1 uppercase tracking-widest text-[10px] font-bold">
                  {STATUS_LABELS[status]}
                </Badge>
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
                   <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Time to Unlock</span>
                   {isLoading ? <Skeleton className="h-10 w-32 bg-edge/20" /> : (
                     <div className="flex flex-col">
                        <span className="text-4xl font-display text-chalk">
                          {a?.duration ? formatDuration(BigInt(a.duration as string)) : '--'}
                        </span>
                        <span className="text-[10px] text-ash uppercase tracking-widest mt-1">
                          From moment of signing
                        </span>
                     </div>
                   )}
                </div>
             </div>
          </section>

          {/* Specifications Grid */}
          <section className="grid sm:grid-cols-3 gap-4">
             {[
               { label: 'Borrower', value: a?.borrower ? formatAddress(a.borrower as string) : '--', mono: true },
               { label: 'Lender', value: a?.lender && a.lender !== '0x0' ? formatAddress(a.lender as string) : (a?.multi_lender ? 'Multi-Lender' : 'Waiting...'), mono: true },
               { label: 'Issued Debt', value: a?.issued_debt_percentage ? `${Number(BigInt(a.issued_debt_percentage as string)) / 100}%` : '0%', mono: false },
             ].map((field, i) => (
               <div key={i} className="bg-abyss/40 border border-edge/20 rounded-2xl p-5">
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">{field.label}</span>
                  <span className={`text-sm text-chalk ${field.mono ? 'font-mono' : 'font-display'}`}>{field.value}</span>
               </div>
             ))}
          </section>

          {/* Assets Table-style view */}
          <section className="bg-surface/10 border border-edge/20 rounded-3xl overflow-hidden">
             <div className="px-6 py-4 border-b border-edge/20 bg-surface/30">
                <h3 className="text-xs uppercase tracking-widest text-dust font-bold">Inscription Assets</h3>
             </div>
             <div className="p-6 space-y-8">
                {(['debt', 'interest', 'collateral'] as const).map((role) => {
                  const roleAssets = assets?.filter((r) => r.asset_role === role) ?? []
                  return (
                    <div key={role} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 shrink-0 w-32">
                         <div className={`w-2 h-2 rounded-full ${role === 'debt' ? 'bg-star' : role === 'interest' ? 'bg-aurora' : 'bg-nebula'}`} />
                         <span className="text-[10px] uppercase tracking-[0.2em] text-ash font-bold">{role}</span>
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
                        ) : <span className="text-xs text-ash italic">None</span>}
                      </div>
                    </div>
                  )
                })}
             </div>
          </section>
        </div>

        {/* Sidebar Actions */}
        <aside className="space-y-6">
          <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden">
             <div className="p-8 space-y-6">
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
                     />
                   )}
                </div>
             </div>
          </Card>

          {/* Detailed Timestamps */}
          <section className="bg-surface/20 border border-edge/20 rounded-3xl p-6 space-y-4">
             <h4 className="text-[10px] uppercase tracking-widest text-ash font-bold">Timeline</h4>
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-dust uppercase">Signed At</span>
                   <span className="text-xs text-chalk font-mono">{a?.signed_at && a.signed_at !== '0' ? formatTimestamp(BigInt(a.signed_at as string)) : 'Unsigned'}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-dust uppercase">Deadline</span>
                   <span className="text-xs text-chalk font-mono">{a?.deadline ? formatTimestamp(BigInt(a.deadline as string)) : '--'}</span>
                </div>
             </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
