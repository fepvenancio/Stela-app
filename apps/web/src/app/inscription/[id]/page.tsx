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
import { findTokenByAddress, STATUS_LABELS } from '@stela/core'
import type { InscriptionStatus } from '@stela/core'
import { formatTokenValue, formatDuration, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
    const borrower = a.borrower as string | undefined
    return borrower ? addressesEqual(address, borrower) : false
  }, [address, inscription])

  const shares = useMemo(() => {
    if (!sharesRaw) return 0n
    return BigInt(sharesRaw as string | bigint)
  }, [sharesRaw])

  const statusLabel = STATUS_LABELS[status]

  // Build info fields from live data
  const a = inscription as Record<string, unknown> | undefined
  const infoFields = [
    { label: 'Status', value: statusLabel },
    { label: 'Duration', value: a?.duration ? formatDuration(BigInt(a.duration as string | bigint)) : '--' },
    { label: 'Borrower', value: a?.borrower ? formatAddress(a.borrower as string) : '--', mono: true },
    { label: 'Lender', value: a?.lender && a.lender !== '0x0' ? formatAddress(a.lender as string) : '--', mono: true },
    { label: 'Debt Issued', value: a?.issued_debt_percentage ? `${Number(BigInt(a.issued_debt_percentage as string | bigint)) / 100}%` : '--' },
    { label: 'Signed At', value: a?.signed_at ? formatTimestamp(BigInt(a.signed_at as string | bigint)) : '--' },
  ]

  return (
    <div className="animate-fade-up max-w-3xl">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-dust hover:text-chalk transition-colors mb-8 group"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-hover:-translate-x-0.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to inscriptions
      </Link>

      {/* Invalid ID */}
      {!isValidId && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Invalid inscription ID</p>
        </div>
      )}

      {/* Loading */}
      {isValidId && isLoading && (
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-64 bg-surface" />
            <Skeleton className="h-5 w-full max-w-md bg-surface" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl bg-surface" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-xl bg-surface" />
          <Skeleton className="h-24 rounded-xl bg-surface" />
        </div>
      )}

      {/* Error */}
      {isValidId && error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load inscription</p>
        </div>
      )}

      {/* Content */}
      {isValidId && !isLoading && inscription && (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-chalk">
                Inscription
              </h1>
              <Badge variant={status as "open" | "partial" | "filled" | "repaid" | "liquidated" | "expired" | "cancelled"}>
                {statusLabel}
              </Badge>
            </div>
            <p className="font-mono text-xs sm:text-sm text-ash break-all leading-relaxed inline-flex items-center gap-2">
              {id}
              <CopyButton value={id} label="Inscription ID" />
            </p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
            {infoFields.map(({ label, value, mono }) => (
              <div key={label} className="p-4 rounded-xl bg-surface/40 border border-edge">
                <div className="text-[11px] text-ash uppercase tracking-wider mb-1.5">{label}</div>
                <div className={`text-sm text-chalk ${mono ? 'font-mono' : 'font-medium'}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <Separator className="mb-6" />

          {/* Assets */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm">Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assetsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48 bg-surface" />
                  <Skeleton className="h-8 w-40 bg-surface" />
                </div>
              ) : assets.length > 0 ? (
                <>
                  {(['debt', 'interest', 'collateral'] as const).map((role) => {
                    const roleAssets = assets.filter((r) => r.asset_role === role)
                    if (roleAssets.length === 0) return null
                    return (
                      <div key={role}>
                        <div className="text-[11px] text-ash uppercase tracking-wider mb-2">{role}</div>
                        <div className="flex flex-wrap gap-2">
                          {roleAssets.map((ra) => {
                            const token = findTokenByAddress(ra.asset_address)
                            const formattedValue = ra.asset_type === 'ERC721'
                              ? undefined
                              : formatTokenValue(ra.value, token?.decimals ?? 18)
                            return (
                              <AssetBadge
                                key={`${ra.asset_role}-${ra.asset_index}`}
                                address={ra.asset_address}
                                assetType={ra.asset_type}
                                value={formattedValue}
                                tokenId={ra.token_id ?? undefined}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : (
                <p className="text-sm text-ash leading-relaxed">
                  {Number(a?.debt_asset_count ?? 0)} debt, {Number(a?.interest_asset_count ?? 0)} interest, {Number(a?.collateral_asset_count ?? 0)} collateral assets
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <InscriptionActions
                inscriptionId={id}
                status={status}
                isOwner={isOwner}
                shares={shares}
                multiLender={Boolean(a?.multi_lender)}
                debtAssets={assets
                  .filter((r) => r.asset_role === 'debt')
                  .map((r) => ({ address: r.asset_address, value: r.value ?? '0' }))}
                debtDecimals={(() => {
                  const da = assets.filter((r) => r.asset_role === 'debt')
                  const token = da[0] ? findTokenByAddress(da[0].asset_address) : undefined
                  return token?.decimals ?? 18
                })()}
                wasSigned={Number(a?.signed_at ?? 0) > 0}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Not found */}
      {isValidId && !isLoading && !error && !inscription && (
        <div className="text-center py-24">
          <p className="text-dust text-sm">Inscription not found on-chain</p>
        </div>
      )}
    </div>
  )
}
