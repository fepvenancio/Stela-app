'use client'

import { useState } from 'react'
import type { InscriptionStatus } from '@stela/core'

interface InscriptionActionsProps {
  inscriptionId: string
  status: InscriptionStatus
  isOwner: boolean
  hasShares: boolean
}

export function InscriptionActions({ inscriptionId, status, isOwner, hasShares }: InscriptionActionsProps) {
  const [percentage, setPercentage] = useState('')

  if (status === 'open' || status === 'partial') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-dust">Sign as lender by committing a percentage of the debt.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            // Wire to useSign(inscriptionId, BigInt(percentage))
          }}
          className="flex gap-3"
        >
          <div className="flex-1 relative">
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="Percentage"
              min="1"
              max="10000"
              className="w-full bg-abyss border border-edge rounded-xl px-4 py-2.5 text-sm text-chalk placeholder:text-ash focus:border-star focus:outline-none focus:ring-1 focus:ring-star/30 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ash select-none">
              BPS
            </span>
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_20px_-5px_rgba(232,168,37,0.3)]"
          >
            Sign
          </button>
        </form>
      </div>
    )
  }

  if (status === 'filled' && isOwner) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription is fully signed. Repay to release your collateral.</p>
        <button className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-b from-aurora to-aurora/80 text-void hover:shadow-[0_0_20px_-5px_rgba(45,212,191,0.35)] transition-all duration-200">
          Repay Inscription
        </button>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">This inscription has expired without repayment. Liquidate to claim collateral.</p>
        <button className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-b from-nova to-nova/80 text-white hover:shadow-[0_0_20px_-5px_rgba(240,101,101,0.35)] transition-all duration-200">
          Liquidate
        </button>
      </div>
    )
  }

  if ((status === 'repaid' || status === 'liquidated') && hasShares) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-dust">
          {status === 'repaid' ? 'Inscription repaid. Redeem your shares for the interest.' : 'Inscription liquidated. Redeem your shares for the collateral.'}
        </p>
        <button className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-b from-cosmic to-cosmic/80 text-white hover:shadow-[0_0_20px_-5px_rgba(167,139,250,0.35)] transition-all duration-200">
          Redeem Shares
        </button>
      </div>
    )
  }

  return <p className="text-sm text-ash">No actions available for this inscription.</p>
}
