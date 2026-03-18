'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { StarknetConfig, jsonRpcProvider } from '@starknet-react/core'
import { sepolia, mainnet } from '@starknet-react/chains'
import { NETWORK } from '@/lib/config'
import { connectors } from '@/lib/connectors'

const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia'

const provider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: rpcUrl, default_block: 'latest' as const }),
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <StarknetConfig
          chains={chains}
          provider={provider}
          connectors={connectors}
          autoConnect
        >
          {children}
        </StarknetConfig>
      </NuqsAdapter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
