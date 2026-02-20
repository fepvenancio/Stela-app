'use client'

import { StarknetConfig, argent, braavos, publicProvider } from '@starknet-react/core'
import { sepolia, mainnet } from '@starknet-react/chains'
import { NETWORK } from '@/lib/config'

const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={publicProvider()}
      connectors={[argent(), braavos()]}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}
