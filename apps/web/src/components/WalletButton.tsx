'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import type { Connector } from '@starknet-react/core'
import { Button } from '@/components/ui/button'
import { AddressDisplay } from '@/components/AddressDisplay'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// Wallet metadata for icons and display names
const WALLET_META: Record<string, { name: string; icon: string }> = {
  argentX: {
    name: 'Argent X',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjRkY4NzVCIi8+PHBhdGggZD0iTTE4LjMxNiA3LjE2MkgxMy42NjhMMTAuMjIyIDI0LjgzOGgyLjgxNmwuODM2LTQuMzA4aDQuMjM2bC44MzYgNC4zMDhoMi44MTZMMTguMzE2IDcuMTYyWm0tMy44NTIgMTEuMDc4bDEuNTI4LTcuODc2IDEuNTI4IDcuODc2aC0zLjA1NloiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
  },
  braavos: {
    name: 'Braavos',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjRURCOTJCIi8+PHBhdGggZD0iTTE2IDcuNWwtNy41IDkgMyA0LjUgNC41LTYgNC41IDYgMy00LjUtNy41LTlaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
  },
}

function getWalletMeta(connector: Connector) {
  const id = connector.id
  const meta = WALLET_META[id]
  return {
    name: meta?.name ?? connector.name ?? id,
    icon: meta?.icon ?? (typeof connector.icon === 'string' ? connector.icon : connector.icon?.dark ?? ''),
  }
}

function NetworkIndicator() {
  const { chain } = useNetwork()
  const isTestnet = chain.network === 'sepolia'
  const name = isTestnet ? 'StarkNet Sepolia' : 'StarkNet Mainnet'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="p-2 rounded-full hover:bg-surface/50 transition-colors cursor-help group" aria-label={`Network: ${name}`}>
          <div className="relative">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className={`${isTestnet ? 'text-star/60' : 'text-star'} transition-all group-hover:scale-110`}
              aria-hidden="true"
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

function ConnectWalletModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { connect, connectors } = useConnect()
  const [availability, setAvailability] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function check() {
      const results: Record<string, boolean> = {}
      for (const c of connectors) {
        try {
          results[c.id] = await c.available()
        } catch {
          results[c.id] = false
        }
      }
      if (!cancelled) setAvailability(results)
    }
    check()
    return () => { cancelled = true }
  }, [open, connectors])

  const handleConnect = (connector: Connector) => {
    connect({ connector })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-void border-edge/30 sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-chalk font-display tracking-wide text-lg">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-dust text-xs">
            Choose a StarkNet wallet to connect
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2">
          {connectors.map((connector) => {
            const { name, icon } = getWalletMeta(connector)
            const isAvailable = availability[connector.id]
            const isChecking = availability[connector.id] === undefined

            return (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-edge/30 bg-surface/10 hover:bg-surface/30 hover:border-star/20 transition-all text-left group"
              >
                {icon ? (
                  <img src={icon} alt={name} width={28} height={28} className="rounded-lg shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-surface/50 border border-edge/30 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dust">
                      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
                      <path d="M3 5v14a2 2 0 002 2h16v-5" />
                      <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-chalk text-sm font-medium group-hover:text-star transition-colors">
                    {name}
                  </span>
                  {!isChecking && !isAvailable && (
                    <span className="block text-[10px] text-ash mt-0.5">Not installed</span>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dust group-hover:text-star transition-colors shrink-0">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccountModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { address, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()

  if (!address) return null

  const wallet = connector ? getWalletMeta(connector) : null
  const isTestnet = chain.network === 'sepolia'
  const networkName = isTestnet ? 'StarkNet Sepolia' : 'StarkNet Mainnet'

  const handleDisconnect = () => {
    disconnect()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-void border-edge/30 sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-chalk font-display tracking-wide text-lg">
            Connected
          </DialogTitle>
          <DialogDescription className="sr-only">
            Wallet account details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Wallet info */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-edge/20 bg-surface/10">
            {wallet?.icon ? (
              <img src={wallet.icon} alt={wallet.name} width={32} height={32} className="rounded-lg shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-surface/50 border border-edge/30 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-chalk text-sm font-medium block">{wallet?.name ?? 'Wallet'}</span>
              <AddressDisplay address={address} className="text-xs text-dust" />
            </div>
          </div>

          {/* Network */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-edge/20 bg-surface/10">
            <span className="text-dust text-xs">Network</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isTestnet ? 'bg-amber-600' : 'bg-aurora'}`} />
              <span className="text-chalk text-xs font-medium">{networkName}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="w-full border-edge/30 text-dust hover:text-nova hover:border-nova/30 rounded-xl"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function WalletButton() {
  const { address, status, connector } = useAccount()
  const [connectOpen, setConnectOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  if (status === 'connected' && address) {
    const wallet = connector ? getWalletMeta(connector) : null

    return (
      <>
        <div className="flex items-center gap-1">
          <NetworkIndicator />
          <Button
            variant="outline"
            onClick={() => setAccountOpen(true)}
            className="group gap-2.5 h-10 border-edge/50 hover:border-star/30 rounded-2xl bg-surface/20"
            aria-label="Wallet account"
          >
            {wallet?.icon && (
              <img src={wallet.icon} alt="" width={18} height={18} className="rounded shrink-0" />
            )}
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
        <AccountModal open={accountOpen} onOpenChange={setAccountOpen} />
      </>
    )
  }

  return (
    <>
      <Button variant="gold" size="lg" className="rounded-full px-8 shadow-lg shadow-star/10 hover:shadow-star/20" onClick={() => setConnectOpen(true)}>
        Connect Wallet
      </Button>
      <ConnectWalletModal open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  )
}
