'use client'

import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { formatAddress } from '@/lib/address'

export function WalletButton() {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (status === 'connected' && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface border border-edge hover:border-edge-bright transition-all duration-200"
      >
        <span
          className="w-2 h-2 rounded-full bg-aurora shrink-0"
          style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
        />
        <span className="font-mono text-sm text-dust group-hover:text-chalk transition-colors">
          {formatAddress(address)}
        </span>
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_20px_-5px_rgba(232,168,37,0.3)] hover:shadow-[0_0_25px_-5px_rgba(232,168,37,0.45)]"
        >
          {connector.name}
        </button>
      ))}
    </div>
  )
}
