'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  ArrowLeftRight,
  ArrowDown,
  ChevronDown,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { TokenAvatar } from '@/components/TokenAvatar'

export default function SwapPage() {
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])

  const [swapMode, setSwapMode] = useState<'tokens' | 'stelas'>('tokens')
  const [sellToken, setSellToken] = useState<TokenInfo>(tokens[0])
  const [buyToken, setBuyToken] = useState<TokenInfo>(tokens[1] ?? tokens[0])
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')

  const updateSellToken = (symbol: string) => {
    const found = tokens.find((t) => t.symbol === symbol)
    if (found) setSellToken(found)
  }

  const updateBuyToken = (symbol: string) => {
    const found = tokens.find((t) => t.symbol === symbol)
    if (found) setBuyToken(found)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-12"
    >
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full border border-accent/20 mx-auto">
          <ArrowLeftRight size={14} className="text-accent" />
          <span className="text-[11px] font-bold text-accent uppercase tracking-widest">
            P2P Liquidity Engine
          </span>
        </div>
        <h1 className="text-5xl font-bold tracking-tighter text-white">Instant Swap</h1>
        <p className="text-gray-500 max-w-lg mx-auto font-medium leading-relaxed">
          Exit your liquid Stelas or swap underlying assets instantly using the Stela P2P engine.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="flex p-1.5 bg-surface rounded-2xl border border-border">
          <button
            onClick={() => setSwapMode('tokens')}
            className={`px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer ${
              swapMode === 'tokens'
                ? 'bg-white text-black shadow-xl'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Swap Tokens
          </button>
          <button
            onClick={() => setSwapMode('stelas')}
            className={`px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer ${
              swapMode === 'stelas'
                ? 'bg-white text-black shadow-xl'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Swap Stelas
          </button>
        </div>
      </div>

      {swapMode === 'tokens' ? (
        <div className="bg-surface rounded-[3rem] border border-border p-12 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />

          <div className="space-y-4">
            {/* Sell box */}
            <div className="bg-white/[0.02] rounded-[2rem] p-8 border border-border group focus-within:border-accent/40 transition-all">
              <div className="flex justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                  Sell
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  placeholder="0.00"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="bg-transparent text-4xl font-mono font-bold outline-none w-full placeholder:text-gray-800"
                />
                <button className="bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 border border-white/5 hover:bg-white/10 transition-colors shrink-0">
                  <TokenAvatar token={sellToken} size={24} />
                  <select
                    value={sellToken.symbol}
                    onChange={(e) => updateSellToken(e.target.value)}
                    className="bg-transparent font-bold outline-none cursor-pointer appearance-none text-white"
                  >
                    {tokens.map((t) => (
                      <option key={t.symbol} value={t.symbol} className="bg-[#0A0A0A]">
                        {t.symbol}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Arrow separator */}
            <div className="flex justify-center -my-6 relative z-10">
              <button className="w-14 h-14 bg-surface border border-border rounded-2xl flex items-center justify-center hover:border-accent transition-colors shadow-xl group cursor-pointer">
                <ArrowDown
                  size={24}
                  className="text-accent group-hover:translate-y-1 transition-transform"
                />
              </button>
            </div>

            {/* Buy box */}
            <div className="bg-white/[0.02] rounded-[2rem] p-8 border border-border group focus-within:border-accent/40 transition-all">
              <div className="flex justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                  Buy
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  placeholder="0.00"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="bg-transparent text-4xl font-mono font-bold outline-none w-full placeholder:text-gray-800"
                />
                <button className="bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 border border-white/5 hover:bg-white/10 transition-colors shrink-0">
                  <TokenAvatar token={buyToken} size={24} />
                  <select
                    value={buyToken.symbol}
                    onChange={(e) => updateBuyToken(e.target.value)}
                    className="bg-transparent font-bold outline-none cursor-pointer appearance-none text-white"
                  >
                    {tokens.map((t) => (
                      <option key={t.symbol} value={t.symbol} className="bg-[#0A0A0A]">
                        {t.symbol}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="p-8 bg-accent/5 rounded-[2rem] border border-accent/10 space-y-4">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Exchange Rate</span>
              <span className="text-white">--</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Slippage Tolerance</span>
              <span className="text-accent">0.5%</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Minimum Received</span>
              <span className="text-white">--</span>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => toast('Coming soon')}
            className="w-full bg-white text-black py-6 rounded-[1.5rem] font-bold text-xs uppercase tracking-[0.3em] hover:bg-gray-200 transition-all shadow-2xl shadow-white/5 cursor-pointer"
          >
            Execute Swap
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-[3rem] border border-border p-12 space-y-8 relative overflow-hidden">
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white tracking-tight">Select Stela to Exit</h3>
            <div className="grid grid-cols-1 gap-4">
              {/* Empty state */}
              <div className="bg-white/[0.02] rounded-[2rem] p-12 border border-dashed border-border text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-white/[0.02] rounded-2xl flex items-center justify-center border border-border">
                    <Layers className="text-accent/40" size={24} />
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                    No swappable Stelas found
                  </p>
                  <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                    Stelas with swap enabled and duration of 0 will appear here for instant exit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
