'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  ArrowLeftRight,
  ArrowDown,
  ChevronDown,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAccount } from '@starknet-react/core'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { formatTokenValue } from '@/lib/format'
import { TokenAvatar } from '@/components/TokenAvatar'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { useTokenBalances } from '@/hooks/useTokenBalances'

export default function SwapPage() {
  const router = useRouter()
  const { status } = useAccount()
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])
  const { balances } = useTokenBalances()

  const [swapMode, setSwapMode] = useState<'tokens' | 'stelas'>('tokens')
  const [sellToken, setSellToken] = useState<TokenInfo>(tokens[0])
  const [buyToken, setBuyToken] = useState<TokenInfo>(tokens[1] ?? tokens[0])
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')

  const [sellModalOpen, setSellModalOpen] = useState(false)
  const [buyModalOpen, setBuyModalOpen] = useState(false)

  const getTokenBalance = (token: TokenInfo): string => {
    const addr = token.addresses[NETWORK]?.toLowerCase() ?? ''
    const rawBalance = balances.get(addr)
    return rawBalance !== undefined
      ? formatTokenValue(rawBalance.toString(), token.decimals)
      : '--'
  }

  const handleSwapTokens = () => {
    const prevSell = sellToken
    const prevBuy = buyToken
    const prevSellAmount = sellAmount
    const prevBuyAmount = buyAmount
    setSellToken(prevBuy)
    setBuyToken(prevSell)
    setSellAmount(prevBuyAmount)
    setBuyAmount(prevSellAmount)
  }

  const handleExecuteSwap = () => {
    if (status !== 'connected') {
      toast.error('Connect wallet first')
      return
    }
    if (!sellAmount || Number(sellAmount) <= 0) {
      toast.error('Enter a sell amount')
      return
    }
    if (!buyAmount || Number(buyAmount) <= 0) {
      toast.error('Enter a buy amount')
      return
    }
    toast('Signing swap...')
    router.push('/trade?mode=swap')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto space-y-5 pt-4"
    >
      {/* Header — compact */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full border border-accent/20">
          <ArrowLeftRight size={12} className="text-accent" />
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">P2P Swap</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Instant Swap</h1>
        <p className="text-gray-500 text-xs leading-relaxed">
          Swap assets or exit Stelas using the P2P engine.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="flex p-1 bg-surface rounded-xl border border-border">
          <button
            onClick={() => setSwapMode('tokens')}
            className={`px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.15em] transition-all cursor-pointer ${
              swapMode === 'tokens'
                ? 'bg-white text-black shadow-lg'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Tokens
          </button>
          <button
            onClick={() => setSwapMode('stelas')}
            className={`px-5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-[0.15em] transition-all cursor-pointer ${
              swapMode === 'stelas'
                ? 'bg-white text-black shadow-lg'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Stelas
          </button>
        </div>
      </div>

      {swapMode === 'tokens' ? (
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />

          {/* Sell box */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-border focus-within:border-accent/40 transition-all">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Sell</span>
              <button
                type="button"
                onClick={() => {
                  const addr = sellToken.addresses[NETWORK]?.toLowerCase() ?? ''
                  const raw = balances.get(addr)
                  if (raw !== undefined && raw > 0n) {
                    const maxVal = Number(raw) / 10 ** sellToken.decimals
                    setSellAmount(maxVal.toString())
                  }
                }}
                className="text-[9px] font-bold text-accent hover:text-white transition-colors cursor-pointer"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number" inputMode="decimal" step="any"
                placeholder="0.00"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="bg-transparent text-2xl font-mono font-bold outline-none w-full placeholder:text-gray-800"
              />
              <button
                type="button"
                onClick={() => setSellModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-colors shrink-0 cursor-pointer"
              >
                <TokenAvatar token={sellToken} size={20} />
                <span className="font-bold text-sm text-white">{sellToken.symbol}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-gray-500">
                Balance: {getTokenBalance(sellToken)}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-4 relative z-10">
            <button
              type="button"
              onClick={handleSwapTokens}
              className="w-10 h-10 bg-surface border border-border rounded-xl flex items-center justify-center hover:border-accent transition-colors shadow-lg group cursor-pointer"
            >
              <ArrowDown size={18} className="text-accent group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Buy box */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-border focus-within:border-accent/40 transition-all">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Buy</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number" inputMode="decimal" step="any"
                placeholder="0.00"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="bg-transparent text-2xl font-mono font-bold outline-none w-full placeholder:text-gray-800"
              />
              <button
                type="button"
                onClick={() => setBuyModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-colors shrink-0 cursor-pointer"
              >
                <TokenAvatar token={buyToken} size={20} />
                <span className="font-bold text-sm text-white">{buyToken.symbol}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
            </div>
            <div className="mt-2">
              <span className="text-[10px] text-gray-500">
                Balance: {getTokenBalance(buyToken)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 space-y-2.5">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Exchange Rate</span>
              <span className="text-white">--</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Slippage</span>
              <span className="text-accent">0.5%</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Min Received</span>
              <span className="text-white">--</span>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleExecuteSwap}
            className="w-full bg-white text-black py-3.5 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-gray-200 transition-all shadow-xl shadow-white/5 cursor-pointer"
          >
            Execute Swap
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-white tracking-tight">Select Stela to Exit</h3>
          <div className="bg-white/[0.02] rounded-xl p-8 border border-dashed border-border text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white/[0.02] rounded-xl flex items-center justify-center border border-border">
                <Layers className="text-accent/40" size={20} />
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em]">
                No swappable Stelas found
              </p>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                Stelas with swap enabled and duration 0 appear here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sell token modal */}
      <TokenSelectorModal
        open={sellModalOpen}
        onOpenChange={setSellModalOpen}
        onSelect={(token) => setSellToken(token)}
        selectedAddress={sellToken.addresses[NETWORK] ?? ''}
        balances={balances}
        showCustomOption={false}
      />

      {/* Buy token modal */}
      <TokenSelectorModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        onSelect={(token) => setBuyToken(token)}
        selectedAddress={buyToken.addresses[NETWORK] ?? ''}
        balances={balances}
        showCustomOption={false}
      />
    </motion.div>
  )
}
