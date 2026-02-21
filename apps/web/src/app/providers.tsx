'use client'

import { StarknetConfig, publicProvider } from '@starknet-react/core'
import type { Connector } from '@starknet-react/core'
import { sepolia, mainnet } from '@starknet-react/chains'
import { NETWORK } from '@/lib/config'
import { connectors } from '@/lib/connectors'

const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={publicProvider()}
      connectors={connectors as unknown as Connector[]}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}
