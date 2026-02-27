'use client'

import { useState, useEffect } from 'react'
import { StarknetConfig, jsonRpcProvider, cartridge } from '@starknet-react/core'
import type { Connector } from '@starknet-react/core'
import { sepolia, mainnet } from '@starknet-react/chains'
import { NETWORK, CONTRACT_ADDRESS } from '@/lib/config'
import { connectors as baseConnectors } from '@/lib/connectors'

const chains = NETWORK === 'mainnet' ? [mainnet] : [sepolia]

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia'

const provider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: rpcUrl }),
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [allConnectors, setAllConnectors] = useState<Connector[]>(baseConnectors)

  useEffect(() => {
    // Dynamically load Cartridge Controller on client side only (uses WASM)
    import('@cartridge/connector').then(({ ControllerConnector }) => {
      const controller = new ControllerConnector({
        policies: {
          contracts: {
            [CONTRACT_ADDRESS]: {
              name: 'Stela Protocol',
              methods: [
                { name: 'create_inscription', entrypoint: 'create_inscription' },
                { name: 'sign_inscription', entrypoint: 'sign_inscription' },
                { name: 'cancel_inscription', entrypoint: 'cancel_inscription' },
                { name: 'repay', entrypoint: 'repay' },
                { name: 'liquidate', entrypoint: 'liquidate' },
                { name: 'redeem_shares', entrypoint: 'redeem_shares' },
                { name: 'settle', entrypoint: 'settle' },
              ],
            },
          },
        },
      })
      // Browser wallets (Argent/Braavos) first, Cartridge last as fallback
      setAllConnectors([...baseConnectors, controller as unknown as Connector])
    }).catch((err) => {
      console.warn('Failed to load Cartridge Controller:', err)
    })
  }, [])

  return (
    <StarknetConfig
      chains={chains}
      provider={provider}
      connectors={allConnectors}
      explorer={cartridge}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}
