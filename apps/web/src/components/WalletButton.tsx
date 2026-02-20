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
        className="px-4 py-2 rounded bg-neutral-800 text-sm hover:bg-neutral-700"
      >
        {formatAddress(address)}
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="px-4 py-2 rounded bg-blue-600 text-sm hover:bg-blue-500"
        >
          {connector.name}
        </button>
      ))}
    </div>
  )
}
