'use client'

import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatAddress } from '@/lib/address'
import { formatDuration, formatTimestamp } from '@/lib/format'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'

interface StelaDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inscription: {
    id: string
    status: string
    borrower?: string
    lender?: string
    duration?: number | bigint | string
    deadline?: number | bigint | string
    signed_at?: number | bigint | string
    issued_debt_percentage?: number | bigint | string
    multi_lender?: boolean
    debt_asset_count?: number
    interest_asset_count?: number
    collateral_asset_count?: number
    [key: string]: unknown
  } | null
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{label}</span>
      <p className={`text-sm text-white mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

export function StelaDetailsModal({ open, onOpenChange, inscription }: StelaDetailsModalProps) {
  if (!inscription) return null

  const status = inscription.status as InscriptionStatus
  const duration = inscription.duration ? BigInt(inscription.duration) : 0n
  const durationDisplay = duration > 0n ? formatDuration(duration) : 'Instant'

  const signedAt = inscription.signed_at ? BigInt(inscription.signed_at) : 0n
  const signedAtDisplay = signedAt > 0n ? formatTimestamp(signedAt) : 'Unsigned'

  const deadline = inscription.deadline ? BigInt(inscription.deadline) : 0n
  const deadlineDisplay = deadline > 0n ? formatTimestamp(deadline) : '--'

  const issuedDebtPct = inscription.issued_debt_percentage
    ? `${Number(BigInt(inscription.issued_debt_percentage)) / 100}%`
    : '0%'

  const lenderDisplay = (() => {
    const lender = inscription.lender
    const isFilled = status === 'filled' || status === 'repaid' || status === 'liquidated'
    if (lender && lender !== '0x0') return { value: formatAddress(lender), mono: true }
    if (isFilled) return { value: 'Private Lender', mono: false }
    return { value: inscription.multi_lender ? 'Multi-Lender' : 'Waiting...', mono: false }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-400">
              ID: {inscription.id.slice(0, 10)}...
            </span>
            <Badge
              variant={status}
              className="rounded-full px-3 py-0.5 uppercase tracking-widest text-[9px] font-bold"
            >
              {status}
            </Badge>
            {inscription.multi_lender && (
              <Badge
                variant="outline"
                className="rounded-full px-3 py-0.5 uppercase tracking-widest text-[9px] font-bold"
              >
                Multi-Lender
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Participants */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailRow
              label="Borrower"
              value={inscription.borrower ? formatAddress(inscription.borrower) : '—'}
              mono
            />
            <DetailRow
              label="Lender"
              value={lenderDisplay.value}
              mono={lenderDisplay.mono}
            />
          </div>

          {/* Loan terms */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-border/20">
            <DetailRow label="Duration" value={durationDisplay} />
            <DetailRow label="Issued Debt" value={issuedDebtPct} />
            <DetailRow label="Signed At" value={signedAtDisplay} />
            <DetailRow label="Deadline" value={deadlineDisplay} />
          </div>

          {/* Asset counts */}
          {(inscription.debt_asset_count !== undefined ||
            inscription.interest_asset_count !== undefined ||
            inscription.collateral_asset_count !== undefined) && (
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-border/20">
              {inscription.debt_asset_count !== undefined && (
                <DetailRow label="Debt Assets" value={inscription.debt_asset_count} />
              )}
              {inscription.interest_asset_count !== undefined && (
                <DetailRow label="Interest Assets" value={inscription.interest_asset_count} />
              )}
              {inscription.collateral_asset_count !== undefined && (
                <DetailRow label="Collateral Assets" value={inscription.collateral_asset_count} />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="default" className="flex-1" asChild>
              <Link href={`/stela/${inscription.id}`} onClick={() => onOpenChange(false)}>
                View Full Details
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
