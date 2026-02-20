'use client'

import type { AgreementStatus } from '@stela/core'

interface AgreementActionsProps {
  agreementId: string
  status: AgreementStatus
  isOwner: boolean
  hasShares: boolean
}

export function AgreementActions({ agreementId, status, isOwner, hasShares }: AgreementActionsProps) {
  if (status === 'open' || status === 'partial') {
    return (
      <div className="space-y-3">
        <h3 className="font-medium">Lend to this agreement</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            // Will be wired to useSign hook
          }}
          className="flex gap-2"
        >
          <input
            type="number"
            placeholder="Percentage (BPS)"
            max="10000"
            className="flex-1 bg-neutral-800 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-500">
            Sign
          </button>
        </form>
      </div>
    )
  }

  if (status === 'filled' && isOwner) {
    return (
      <button className="px-4 py-2 bg-green-600 rounded text-sm hover:bg-green-500">
        Repay
      </button>
    )
  }

  if (status === 'expired') {
    return (
      <button className="px-4 py-2 bg-red-600 rounded text-sm hover:bg-red-500">
        Liquidate
      </button>
    )
  }

  if ((status === 'repaid' || status === 'liquidated') && hasShares) {
    return (
      <button className="px-4 py-2 bg-purple-600 rounded text-sm hover:bg-purple-500">
        Redeem
      </button>
    )
  }

  return null
}
