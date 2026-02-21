'use client'

import { useAccount } from '@starknet-react/core'
import { WalletButton } from '@/components/WalletButton'

interface Web3ActionWrapperProps {
  children: React.ReactNode
  /** Optional message shown below the connect button when disconnected */
  message?: string
}

/**
 * Shows "Connect Wallet" button when wallet is disconnected,
 * renders children when connected.
 * Inspired by kam-frontend's Web3ActionButtonWrapper.
 */
export function Web3ActionWrapper({ children, message }: Web3ActionWrapperProps) {
  const { status } = useAccount()

  if (status !== 'connected') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <WalletButton />
        {message && <p className="text-xs text-ash">{message}</p>}
      </div>
    )
  }

  return <>{children}</>
}
