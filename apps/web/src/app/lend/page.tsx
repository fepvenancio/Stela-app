'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Plus,
  Trash2,
  ChevronDown,
  Percent,
  RefreshCw,
  ArrowLeftRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { TokenAvatar } from '@/components/TokenAvatar'

interface BasketItem {
  token: TokenInfo
  amount: string
}

export default function LendPage() {
  const router = useRouter()
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])

  const [basket, setBasket] = useState<BasketItem[]>([
    { token: tokens[0], amount: '' },
  ])
  const [interestRate, setInterestRate] = useState('')
  const [repaymentToken, setRepaymentToken] = useState(tokens[0]?.symbol ?? '')

  const addToBasket = () => {
    setBasket((prev) => [...prev, { token: tokens[0], amount: '' }])
  }

  const removeFromBasket = (idx: number) => {
    setBasket((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateBasketToken = (idx: number, symbol: string) => {
    const found = tokens.find((t) => t.symbol === symbol)
    if (!found) return
    setBasket((prev) => prev.map((item, i) => (i === idx ? { ...item, token: found } : item)))
  }

  const updateBasketAmount = (idx: number, amount: string) => {
    setBasket((prev) => prev.map((item, i) => (i === idx ? { ...item, amount } : item)))
  }

  const navigateToBorrow = () => {
    router.push('/borrow')
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-5xl mx-auto space-y-12"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Lend Assets</h1>
          <p className="text-gray-500 mt-2 font-medium">
            Create a liquid Stela to earn interest on your assets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left column — form */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-2xl">
            {/* Tab toggle */}
            <div className="flex p-1.5 bg-white/[0.02] m-8 rounded-2xl border border-border">
              <button
                className="flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all bg-white text-black shadow-xl"
              >
                Lend Assets
              </button>
              <button
                onClick={navigateToBorrow}
                className="flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                Borrow Assets
              </button>
            </div>

            <div className="px-8 pb-10 space-y-10">
              {/* Multi-asset basket */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold tracking-tight text-white">Asset Basket</h3>
                  <button
                    onClick={addToBasket}
                    className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  {basket.map((item, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={idx}
                      className="bg-white/[0.01] rounded-2xl p-5 flex items-center justify-between border border-border group hover:border-accent/20 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-border shadow-inner">
                          <TokenAvatar token={item.token} size={28} />
                        </div>
                        <div className="flex flex-col">
                          <div className="relative">
                            <select
                              value={item.token.symbol}
                              onChange={(e) => updateBasketToken(idx, e.target.value)}
                              className="bg-transparent font-bold text-lg outline-none cursor-pointer appearance-none pr-6 text-white"
                            >
                              {tokens.map((t) => (
                                <option key={t.symbol} value={t.symbol} className="bg-[#0A0A0A]">
                                  {t.symbol}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={14}
                              className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
                            />
                          </div>
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            {item.token.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={item.amount}
                            onChange={(e) => updateBasketAmount(idx, e.target.value)}
                            className="bg-transparent text-right font-mono text-2xl font-medium outline-none w-32 placeholder:text-gray-800"
                          />
                        </div>
                        {basket.length > 1 && (
                          <button
                            onClick={() => removeFromBasket(idx)}
                            className="text-gray-800 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Interest & Repayment Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                      Target Interest
                    </label>
                  </div>
                  <div className="bg-white/[0.01] rounded-2xl p-5 flex items-center justify-between border border-border">
                    <Percent size={18} className="text-gray-700" />
                    <input
                      type="number"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="0.00"
                      className="bg-transparent text-right font-mono text-xl font-medium outline-none w-24 placeholder:text-gray-800"
                    />
                    <span className="text-gray-700 font-bold text-sm ml-2">%</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Repayment Asset
                  </label>
                  <div className="bg-white/[0.01] rounded-2xl p-5 flex items-center justify-between border border-border">
                    <RefreshCw size={18} className="text-gray-700" />
                    <select
                      value={repaymentToken}
                      onChange={(e) => setRepaymentToken(e.target.value)}
                      className="bg-transparent font-bold text-sm outline-none cursor-pointer text-white flex-1 text-right appearance-none"
                    >
                      {tokens.map((t) => (
                        <option key={t.symbol} value={t.symbol} className="bg-[#0A0A0A]">
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="text-gray-700 ml-2" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — summary */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface rounded-3xl border border-border p-8 space-y-8 sticky top-32">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">
              Transaction Summary
            </h3>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Assets</span>
                <span className="font-mono font-bold text-lg text-white">
                  {basket.filter((b) => b.amount && Number(b.amount) > 0).length} token
                  {basket.filter((b) => b.amount && Number(b.amount) > 0).length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Protocol Fee</span>
                <span className="font-bold text-sm text-white">0.25%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Interest Rate</span>
                <span className="font-bold text-sm text-white">
                  {interestRate ? `${interestRate}%` : '--'}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Est. Gas</span>
                <span className="text-xs font-bold text-accent flex items-center gap-1.5 uppercase tracking-widest">
                  <Zap size={14} className="fill-accent" />
                  Gasless
                </span>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center gap-3 text-accent">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Secure P2P Match</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Your offer will be listed on the Stela P2P marketplace. Funds are held in a secure
                StarkNet smart contract.
              </p>
            </div>

            <button
              onClick={() => toast('Coming soon')}
              className="w-full bg-white text-black py-5 rounded-2xl font-bold text-xs uppercase tracking-[0.25em] transition-all hover:bg-gray-200 flex items-center justify-center gap-4 group shadow-2xl shadow-white/5 cursor-pointer"
            >
              Confirm Lending
              <ArrowLeftRight
                size={18}
                className="group-hover:rotate-180 transition-transform duration-1000"
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
