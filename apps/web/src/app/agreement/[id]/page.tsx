'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { useAgreement } from '@/hooks/useAgreement'
import { useShares } from '@/hooks/useShares'
import { AgreementActions } from '@/components/AgreementActions'
import { computeStatus } from '@/lib/status'
import { formatAddress, addressesEqual } from '@/lib/address'
import type { AgreementStatus } from '@stela/core'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

const STATUS_CONFIG: Record<AgreementStatus, { color: string; label: string }> = {
  open: { color: 'bg-aurora/15 text-aurora border-aurora/20', label: 'Open' },
  partial: { color: 'bg-star/15 text-star border-star/20', label: 'Partial' },
  filled: { color: 'bg-nebula/15 text-nebula border-nebula/20', label: 'Filled' },
  repaid: { color: 'bg-aurora/15 text-aurora border-aurora/20', label: 'Repaid' },
  liquidated: { color: 'bg-nova/15 text-nova border-nova/20', label: 'Liquidated' },
  expired: { color: 'bg-ember/15 text-ember border-ember/20', label: 'Expired' },
  cancelled: { color: 'bg-ash/15 text-ash border-ash/20', label: 'Cancelled' },
}

function formatDuration(seconds: bigint): string {
  const s = Number(seconds)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '--'
  return new Date(Number(ts) * 1000).toLocaleString()
}

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id } = use(params)
  const { address } = useAccount()
  const { data: agreement, isLoading, error } = useAgreement(id)
  const { data: sharesRaw } = useShares(id)

  const status = useMemo<AgreementStatus>(() => {
    if (!agreement) return 'open'
    return computeStatus(agreement as Parameters<typeof computeStatus>[0])
  }, [agreement])

  const isOwner = useMemo(() => {
    if (!address || !agreement) return false
    const a = agreement as Record<string, unknown>
    const borrower = a.borrower as string | undefined
    return borrower ? addressesEqual(address, borrower) : false
  }, [address, agreement])

  const hasShares = useMemo(() => {
    if (!sharesRaw) return false
    return BigInt(sharesRaw as string | bigint) > 0n
  }, [sharesRaw])

  const statusCfg = STATUS_CONFIG[status]

  // Build info fields from live data
  const a = agreement as Record<string, unknown> | undefined
  const infoFields = [
    { label: 'Status', value: statusCfg.label },
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
        Back to agreements
      </Link>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 py-24 justify-center">
          <div className="w-4 h-4 border-2 border-star/30 border-t-star rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
          <span className="text-dust text-sm">Loading agreement...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-24">
          <p className="text-nova text-sm">Failed to load agreement</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-chalk">
                Agreement
              </h1>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="font-mono text-xs sm:text-sm text-ash break-all leading-relaxed">{id}</p>
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

          {/* Assets */}
          <div className="p-5 rounded-xl bg-surface/40 border border-edge mb-6">
            <h3 className="text-sm font-medium text-chalk mb-3">Assets</h3>
            {!address ? (
              <p className="text-sm text-ash leading-relaxed">
                Connect your wallet to load asset details from the contract.
              </p>
            ) : (
              <p className="text-sm text-ash leading-relaxed">
                {Number(a?.debt_asset_count ?? 0)} debt, {Number(a?.interest_asset_count ?? 0)} interest, {Number(a?.collateral_asset_count ?? 0)} collateral assets
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="p-5 rounded-xl bg-surface/40 border border-edge">
            <h3 className="text-sm font-medium text-chalk mb-4">Actions</h3>
            <AgreementActions
              agreementId={id}
              status={status}
              isOwner={isOwner}
              hasShares={hasShares}
            />
          </div>
        </>
      )}
    </div>
  )
}
