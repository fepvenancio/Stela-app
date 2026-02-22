'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount } from '@starknet-react/core'
import { RpcProvider, uint256 } from 'starknet'
import { getTokensForNetwork } from '@stela/core'
import type { TokenInfo } from '@stela/core'
import { NETWORK } from '@/lib/config'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.starknet-testnet.lava.build'

const networkTokens = getTokensForNetwork(NETWORK)

export interface TokenBalance {
  token: TokenInfo
  address: string
  balance: bigint
}

/**
 * Fetches ERC20 balanceOf for all known network tokens in the connected wallet.
 * Returns a Map<tokenAddress (lowercase), bigint>.
 */
export function useTokenBalances() {
  const { address } = useAccount()
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const addressRef = useRef(address)
  addressRef.current = address

  useEffect(() => {
    if (!address) {
      setBalances(new Map())
      return
    }

    let cancelled = false
    setIsLoading(true)

    async function fetchBalances() {
      const provider = new RpcProvider({ nodeUrl: RPC_URL })
      const result = new Map<string, bigint>()

      // Fetch all balances in parallel
      const promises = networkTokens.map(async (token) => {
        const tokenAddr = token.addresses[NETWORK]
        if (!tokenAddr) return

        try {
          // Try snake_case first (Cairo standard), fall back to camelCase
          let res: string[]
          try {
            res = await provider.callContract({
              contractAddress: tokenAddr,
              entrypoint: 'balance_of',
              calldata: [address!],
            })
          } catch {
            res = await provider.callContract({
              contractAddress: tokenAddr,
              entrypoint: 'balanceOf',
              calldata: [address!],
            })
          }
          // ERC20 balanceOf returns u256 = [low, high]
          const low = BigInt(res[0] ?? '0')
          const high = BigInt(res[1] ?? '0')
          const balance = uint256.uint256ToBN({ low, high })
          if (balance > 0n) {
            result.set(tokenAddr.toLowerCase(), balance)
          }
        } catch {
          // Token contract not deployed or doesn't implement balance query — skip
        }
      })

      await Promise.all(promises)

      if (!cancelled && addressRef.current === address) {
        setBalances(result)
        setIsLoading(false)
      }
    }

    fetchBalances()

    return () => {
      cancelled = true
    }
  }, [address])

  return { balances, isLoading }
}
