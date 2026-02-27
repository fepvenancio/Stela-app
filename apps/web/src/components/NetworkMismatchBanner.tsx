'use client'

import { useAccount, useNetwork } from '@starknet-react/core'
import { NETWORK } from '@/lib/config'

const EXPECTED_NETWORK_NAME = NETWORK === 'mainnet' ? 'StarkNet Mainnet' : 'StarkNet Sepolia'

export function NetworkMismatchBanner() {
  const { status } = useAccount()
  const { chain } = useNetwork()

  if (status !== 'connected') return null

  const walletNetwork = chain.network
  const expectedNetwork = NETWORK === 'mainnet' ? 'mainnet' : 'sepolia'

  if (walletNetwork === expectedNetwork) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 bg-nova/15 border-b border-nova/30 text-sm text-nova backdrop-blur-sm"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>
        Wrong network detected. Please switch your wallet to <strong>{EXPECTED_NETWORK_NAME}</strong>.
      </span>
    </div>
  )
}
