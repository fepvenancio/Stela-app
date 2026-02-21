'use client'

import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { useStarknetkitConnectModal } from 'starknetkit'
import type { StarknetkitConnector } from 'starknetkit'
import { formatAddress } from '@/lib/address'
import { connectors as modalConnectors } from '@/lib/connectors'

function NetworkBadge() {
  const { chain } = useNetwork()

  const isTestnet = chain.network === 'sepolia'
  const label = isTestnet ? 'Sepolia' : 'Mainnet'

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase ${
        isTestnet
          ? 'bg-aurora/10 text-aurora border border-aurora/20'
          : 'bg-star/10 text-star border border-star/20'
      }`}
    >
      {label}
    </span>
  )
}

export function WalletButton() {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: modalConnectors as unknown as StarknetkitConnector[],
    modalTheme: 'dark',
    dappName: 'Stela Protocol',
  })

  const connectWallet = async () => {
    const { connector } = await starknetkitConnectModal()
    if (connector) {
      // Match starknetkit selection to @starknet-react/core connector by ID
      const match = connectors.find((c) => c.id === connector.id)
      if (match) {
        connect({ connector: match })
      }
    }
  }

  if (status === 'connected' && address) {
    return (
      <div className="flex items-center gap-2">
        <NetworkBadge />
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
      </div>
    )
  }

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_20px_-5px_rgba(232,168,37,0.3)] hover:shadow-[0_0_25px_-5px_rgba(232,168,37,0.45)]"
    >
      Connect Wallet
    </button>
  )
}
