'use client'

import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { useStarknetkitConnectModal } from 'starknetkit'
import type { StarknetkitConnector } from 'starknetkit'
import { connectors as sharedConnectors } from '@/lib/connectors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddressDisplay } from '@/components/AddressDisplay'

function NetworkBadge() {
  const { chain } = useNetwork()

  const isTestnet = chain.network === 'sepolia'
  const label = isTestnet ? 'Sepolia' : 'Mainnet'

  return (
    <Badge variant={isTestnet ? 'testnet' : 'mainnet'} className="text-[10px] tracking-wide uppercase">
      {label}
    </Badge>
  )
}

export function WalletButton() {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  // Use the same shared connectors for the starknetkit modal
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: sharedConnectors as unknown as StarknetkitConnector[],
    modalTheme: 'dark',
    dappName: 'Stela Protocol',
  })

  const connectWallet = async () => {
    const { connector } = await starknetkitConnectModal()
    if (connector) {
      // Match against the @starknet-react/core connectors (which are now the same instances)
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
        <Button
          variant="outline"
          onClick={() => disconnect()}
          className="group gap-2.5"
        >
          <span
            className="w-2 h-2 rounded-full bg-aurora shrink-0"
            style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
          />
          <AddressDisplay address={address} className="text-sm text-dust group-hover:text-chalk transition-colors" />
        </Button>
      </div>
    )
  }

  return (
    <Button variant="gold" onClick={connectWallet}>
      Connect Wallet
    </Button>
  )
}
