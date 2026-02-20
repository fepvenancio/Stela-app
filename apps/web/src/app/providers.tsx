'use client'

import { StarknetConfig, argent, braavos, publicProvider } from '@starknet-react/core'
import { sepolia } from '@starknet-react/chains'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={[argent(), braavos()]}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}
