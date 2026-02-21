'use client'

import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { useStarknetkitConnectModal } from 'starknetkit'
import type { StarknetkitConnector } from 'starknetkit'
import { connectors as sharedConnectors } from '@/lib/connectors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddressDisplay } from '@/components/AddressDisplay'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function NetworkIndicator() {
  const { chain } = useNetwork()
  const isTestnet = chain.network === 'sepolia'
  const name = isTestnet ? 'StarkNet Sepolia' : 'StarkNet Mainnet'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="p-2 rounded-full hover:bg-surface/50 transition-colors cursor-help group">
          <div className="relative">
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              className={`${isTestnet ? 'text-star/60' : 'text-star'} transition-all group-hover:scale-110`}
            >
              <path 
                d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" 
                fill="currentColor" 
                className={!isTestnet ? 'drop-shadow-[0_0_8px_rgba(232,168,37,0.5)]' : ''}
              />
            </svg>
            <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isTestnet ? 'bg-amber-600' : 'bg-aurora'} border border-void`} />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-abyss border-edge text-chalk">
        {name}
      </TooltipContent>
    </Tooltip>
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
      <div className="flex items-center gap-1">
        <NetworkIndicator />
        <Button
          variant="outline"
          onClick={() => disconnect()}
          className="group gap-2.5 h-10 border-edge/50 hover:border-star/30 rounded-2xl bg-surface/20"
        >
          <div className="relative flex items-center justify-center">
            <span
              className="w-2 h-2 rounded-full bg-aurora shrink-0"
              style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
            />
            <span className="absolute inset-0 rounded-full bg-aurora/40 animate-ping opacity-20" />
          </div>
          <AddressDisplay address={address} className="text-sm font-mono text-dust group-hover:text-star transition-colors" />
        </Button>
      </div>
    )
  }

  return (
    <Button variant="gold" size="lg" className="rounded-full px-8 shadow-lg shadow-star/10 hover:shadow-star/20" onClick={connectWallet}>
      Connect Wallet
    </Button>
  )
}
