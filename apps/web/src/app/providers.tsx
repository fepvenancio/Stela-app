'use client'

import { StarknetConfig, argent, braavos, jsonRpcProvider } from '@starknet-react/core'
import { sepolia, mainnet } from '@starknet-react/chains'
import { NETWORK } from '@/lib/config'

const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.starknet-testnet.lava.build'

const provider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: rpcUrl }),
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={provider}
      connectors={[argent(), braavos()]}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}
