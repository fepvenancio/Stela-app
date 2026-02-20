'use client'

import { use } from 'react'
import { WalletButton } from '@/components/WalletButton'
import { AgreementActions } from '@/components/AgreementActions'
import { formatAddress } from '@/lib/address'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id } = use(params)

  // In production, useAgreement(id) and useShares(id) would provide live data.
  // For now, render a placeholder that shows the structure.

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agreement Detail</h1>
        <WalletButton />
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="p-4 rounded-lg border border-neutral-800">
          <div className="text-sm text-neutral-400 mb-1">Agreement ID</div>
          <div className="font-mono text-sm break-all">{id}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-400 mb-1">Status</div>
            <div className="font-medium">--</div>
          </div>
          <div className="p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-400 mb-1">Duration</div>
            <div className="font-medium">--</div>
          </div>
          <div className="p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-400 mb-1">Borrower</div>
            <div className="font-mono text-sm">--</div>
          </div>
          <div className="p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-400 mb-1">Lender</div>
            <div className="font-mono text-sm">--</div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-neutral-800">
          <h3 className="font-medium mb-2">Assets</h3>
          <p className="text-sm text-neutral-500">
            Connect wallet and wait for contract data to load asset details.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-neutral-800">
          <h3 className="font-medium mb-3">Actions</h3>
          <AgreementActions
            agreementId={id}
            status="open"
            isOwner={false}
            hasShares={false}
          />
        </div>
      </div>
    </div>
  )
}
