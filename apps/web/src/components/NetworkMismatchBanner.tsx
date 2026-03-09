'use client'

import { useState } from 'react'
import { useAccount, useNetwork } from '@starknet-react/core'
import { NETWORK, CHAIN_ID } from '@/lib/config'

const EXPECTED_NETWORK_NAME = NETWORK === 'mainnet' ? 'StarkNet Mainnet' : 'StarkNet Sepolia'

function getWalletInstructions(connectorId: string | undefined): string | null {
  switch (connectorId) {
    case 'argentX':
      return 'Open Argent X extension \u2192 Settings \u2192 Developer settings \u2192 Network \u2192 Select Sepolia'
    case 'braavos':
      return 'Open Braavos extension \u2192 Settings \u2192 Network \u2192 Select Sepolia Testnet'
    default:
      return null
  }
}

export function NetworkMismatchBanner() {
  const { status, connector } = useAccount()
  const { chain } = useNetwork()
  const [showInstructions, setShowInstructions] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (status !== 'connected') return null

  const walletNetwork = chain.network
  const expectedNetwork = NETWORK === 'mainnet' ? 'mainnet' : 'sepolia'

  if (walletNetwork === expectedNetwork) return null

  const walletInstructions = getWalletInstructions(connector?.id)
  const genericInstructions = `Switch your wallet to the ${EXPECTED_NETWORK_NAME} network`

  async function handleSwitch() {
    setSwitching(true)
    try {
      // Attempt programmatic chain switch via wallet_switchStarknetChain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = (connector as any)?.request
      if (typeof req === 'function') {
        await req({
          type: 'wallet_switchStarknetChain',
          params: { chainId: CHAIN_ID },
        })
      } else {
        // Wallet doesn't support request — show manual instructions
        setShowInstructions(true)
      }
    } catch {
      // Programmatic switch failed or was rejected — show manual instructions
      setShowInstructions(true)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 bg-nova/15 border-b border-nova/30 text-sm text-nova"
    >
      <div className="flex items-center justify-center gap-3 px-4 py-2.5">
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
          Wrong network detected. Please switch to <strong>{EXPECTED_NETWORK_NAME}</strong>.
        </span>
        <button
          onClick={handleSwitch}
          disabled={switching}
          className="ml-1 px-3 py-1 rounded-lg text-xs font-medium bg-nova/20 hover:bg-nova/30 border border-nova/40 hover:border-nova/60 text-nova transition-colors disabled:opacity-50"
          aria-label={`Switch to ${EXPECTED_NETWORK_NAME}`}
        >
          {switching ? 'Switching...' : 'Switch Network'}
        </button>
        <button
          onClick={() => setShowInstructions((prev) => !prev)}
          className="px-2 py-1 rounded-lg text-xs text-nova/70 hover:text-nova hover:bg-nova/10 transition-colors"
          aria-label={showInstructions ? 'Hide instructions' : 'Show instructions'}
          aria-expanded={showInstructions}
        >
          {showInstructions ? 'Hide help' : 'Help'}
        </button>
      </div>

      {showInstructions && (
        <div className="px-4 pb-3 pt-0.5 text-xs text-nova/80 border-t border-nova/15">
          <p className="text-center">
            {walletInstructions ?? genericInstructions}
          </p>
        </div>
      )}
    </div>
  )
}
