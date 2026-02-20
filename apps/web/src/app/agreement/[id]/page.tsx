'use client'

import { use } from 'react'
import Link from 'next/link'
import { AgreementActions } from '@/components/AgreementActions'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

const INFO_FIELDS = [
  { label: 'Status', value: '--' },
  { label: 'Duration', value: '--' },
  { label: 'Borrower', value: '--', mono: true },
  { label: 'Lender', value: '--', mono: true },
  { label: 'Debt Issued', value: '--' },
  { label: 'Signed At', value: '--' },
]

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id } = use(params)

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

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-chalk">
            Agreement
          </h1>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-aurora/15 text-aurora border border-aurora/20">
            Open
          </span>
        </div>
        <p className="font-mono text-xs sm:text-sm text-ash break-all leading-relaxed">{id}</p>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
        {INFO_FIELDS.map(({ label, value, mono }) => (
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
        <p className="text-sm text-ash leading-relaxed">
          Connect your wallet to load asset details from the contract.
        </p>
      </div>

      {/* Actions */}
      <div className="p-5 rounded-xl bg-surface/40 border border-edge">
        <h3 className="text-sm font-medium text-chalk mb-4">Actions</h3>
        <AgreementActions
          agreementId={id}
          status="open"
          isOwner={false}
          hasShares={false}
        />
      </div>
    </div>
  )
}
