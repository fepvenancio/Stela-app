'use client'

import { useState, useRef, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useNetwork } from '@starknet-react/core'
import { formatAddress } from '@/lib/address'

function NetworkBadge() {
  const { chain } = useNetwork()

  const isTestnet = chain.network === 'sepolia'
  const label = isTestnet ? 'Sepolia' : 'Mainnet'

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase ${
        isTestnet
          ? 'bg-aurora/10 text-aurora border border-aurora/20'
          : 'bg-star/10 text-star border border-star/20'
      }`}
    >
      {label}
    </span>
  )
}

export function WalletButton() {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (status === 'connected' && address) {
    return (
      <div className="flex items-center gap-2">
        <NetworkBadge />
        <button
          onClick={() => disconnect()}
          className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface border border-edge hover:border-edge-bright transition-all duration-200"
        >
          <span
            className="w-2 h-2 rounded-full bg-aurora shrink-0"
            style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
          />
          <span className="font-mono text-sm text-dust group-hover:text-chalk transition-colors">
            {formatAddress(address)}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_20px_-5px_rgba(232,168,37,0.3)] hover:shadow-[0_0_25px_-5px_rgba(232,168,37,0.45)]"
      >
        Connect Wallet
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl bg-surface border border-edge shadow-xl shadow-void/50 overflow-hidden z-50 animate-fade-up">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector })
                setOpen(false)
              }}
              className="w-full px-4 py-3 text-left text-sm text-chalk hover:bg-star/10 hover:text-star transition-colors flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-edge shrink-0" />
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
