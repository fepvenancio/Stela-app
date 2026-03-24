'use client'

import { useAccount } from '@starknet-react/core'
import { WalletButton } from '@/components/WalletButton'

interface Web3ActionWrapperProps {
  children: React.ReactNode
  /** Optional message shown below the connect button when disconnected */
  message?: string
  /** Center vertically in viewport (default true). Set false to keep inline. */
  centered?: boolean
}

/**
 * Shows "Connect Wallet" button when wallet is disconnected,
 * renders children when connected.
 * Inspired by kam-frontend's Web3ActionButtonWrapper.
 */
export function Web3ActionWrapper({ children, message, centered = true }: Web3ActionWrapperProps) {
  const { status } = useAccount()

  if (status !== 'connected') {
    return (
      <div className={`flex flex-col items-center gap-3 ${centered ? 'justify-center min-h-[60vh]' : 'py-4'}`}>
        <WalletButton />
        {message && <p className="text-xs text-gray-400">{message}</p>}
      </div>
    )
  }

  return <>{children}</>
}
