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
  Clock,
  Wifi,
  WifiOff,
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

interface BasketItem {
  token: TokenInfo
  amount: string
}

export default function LendPage() {
  const router = useRouter()
  const { status } = useAccount()
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])
  const { balances } = useTokenBalances()

  const [basket, setBasket] = useState<BasketItem[]>([
    { token: tokens[0], amount: '' },
  ])
  const [interestRate, setInterestRate] = useState('')
  const [repaymentToken, setRepaymentToken] = useState<TokenInfo>(tokens[0])
  const [duration, setDuration] = useState('')
  const [gasless, setGasless] = useState(true)

  // Modal state: null = closed, number = which basket index is open, 'repayment' = repayment modal
  const [tokenModalIndex, setTokenModalIndex] = useState<number | 'repayment' | null>(null)

  const addToBasket = () => {
    setBasket((prev) => [...prev, { token: tokens[0], amount: '' }])
  }

  const removeFromBasket = (idx: number) => {
    setBasket((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateBasketAmount = (idx: number, amount: string) => {
    setBasket((prev) => prev.map((item, i) => (i === idx ? { ...item, amount } : item)))
  }

  const navigateToBorrow = () => {
    router.push('/borrow')
  }

  const getTokenBalance = (token: TokenInfo): string => {
    const addr = token.addresses[NETWORK]?.toLowerCase() ?? ''
    const rawBalance = balances.get(addr)
    return rawBalance !== undefined
      ? formatTokenValue(rawBalance.toString(), token.decimals)
      : '--'
  }

  const handleConfirmLending = () => {
    if (status !== 'connected') {
      toast.error('Connect wallet first')
      return
    }
    const filledItems = basket.filter((b) => b.amount && Number(b.amount) > 0)
    if (filledItems.length === 0) {
      toast.error('Enter an amount for at least one asset')
      return
    }
    if (!interestRate || Number(interestRate) <= 0) {
      toast.error('Enter a target interest rate')
      return
    }
    toast('Signing order...')
    router.push('/trade?mode=lend')
  }

  // Determine which token is "selected" for the currently open modal
  const activeBasketToken =
    typeof tokenModalIndex === 'number' ? basket[tokenModalIndex]?.token : undefined
  const activeSelectedAddress =
    tokenModalIndex === 'repayment'
      ? (repaymentToken.addresses[NETWORK] ?? '')
      : (activeBasketToken?.addresses[NETWORK] ?? '')

  const handleTokenSelect = (token: TokenInfo) => {
    if (tokenModalIndex === 'repayment') {
      setRepaymentToken(token)
    } else if (typeof tokenModalIndex === 'number') {
      setBasket((prev) =>
        prev.map((item, i) => (i === tokenModalIndex ? { ...item, token } : item)),
      )
    }
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
                      className="bg-white/[0.01] rounded-2xl p-5 border border-border group hover:border-accent/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-border shadow-inner">
                            <TokenAvatar token={item.token} size={28} />
                          </div>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => setTokenModalIndex(idx)}
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="font-bold text-lg text-white">{item.token.symbol}</span>
                              <ChevronDown size={14} className="text-gray-500" />
                            </button>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              {item.token.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const addr = item.token.addresses[NETWORK]?.toLowerCase() ?? ''
                                  const raw = balances.get(addr)
                                  if (raw !== undefined && raw > 0n) {
                                    const maxVal = Number(raw) / 10 ** item.token.decimals
                                    updateBasketAmount(idx, maxVal.toString())
                                  }
                                }}
                                className="text-[9px] font-bold text-accent hover:text-white transition-colors cursor-pointer"
                              >
                                MAX
                              </button>
                              <input
                                type="number" inputMode="decimal" step="any"
                                placeholder="0.00"
                                value={item.amount}
                                onChange={(e) => updateBasketAmount(idx, e.target.value)}
                                className="bg-transparent text-right font-mono text-xl font-medium outline-none w-32 placeholder:text-gray-800"
                              />
                            </div>
                          </div>
                          {basket.length > 1 && (
                            <button
                              onClick={() => removeFromBasket(idx)}
                              className="text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 pl-16">
                        <span className="text-[10px] text-gray-500">
                          Balance: {getTokenBalance(item.token)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Interest & Repayment Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Target Interest
                  </label>
                  <div className="bg-white/[0.01] rounded-2xl h-14 px-5 flex items-center gap-3 border border-border">
                    <Percent size={16} className="text-gray-600 shrink-0" />
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="0.00"
                      className="bg-transparent flex-1 text-right font-mono text-base font-bold outline-none placeholder:text-gray-800"
                    />
                    <span className="text-gray-500 font-bold text-xs shrink-0">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Repayment Asset
                  </label>
                  <button
                    type="button"
                    onClick={() => setTokenModalIndex('repayment')}
                    className="bg-white/[0.01] rounded-2xl h-14 px-5 flex items-center gap-3 border border-border hover:border-accent/20 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={16} className="text-gray-600 shrink-0" />
                    <div className="flex-1" />
                    <TokenAvatar token={repaymentToken} size={20} />
                    <span className="font-bold text-sm text-white">{repaymentToken.symbol}</span>
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Duration & Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Offer Duration (Days)
                  </label>
                  <div className="bg-white/[0.01] rounded-2xl h-14 px-5 flex items-center gap-3 border border-border">
                    <Clock size={16} className="text-gray-600 shrink-0" />
                    <input
                      type="number" inputMode="decimal" step="1" min="0"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="7"
                      className="bg-transparent flex-1 text-right font-mono text-base font-bold outline-none placeholder:text-gray-800"
                    />
                    <span className="text-gray-500 font-bold text-xs shrink-0">days</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Funding Mode
                  </label>
                  <div className="bg-white/[0.01] rounded-2xl h-14 px-1.5 flex items-center border border-border">
                    <button
                      type="button"
                      onClick={() => setGasless(true)}
                      className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-[0.15em] transition-all cursor-pointer ${
                        gasless
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      <Wifi size={14} />
                      Gasless
                    </button>
                    <button
                      type="button"
                      onClick={() => setGasless(false)}
                      className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-[0.15em] transition-all cursor-pointer ${
                        !gasless
                          ? 'bg-white/10 text-white border border-white/10'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      <WifiOff size={14} />
                      On-Chain
                    </button>
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
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Duration</span>
                <span className="font-bold text-sm text-white">
                  {duration ? `${duration} days` : '--'}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Est. Gas</span>
                <span className="text-xs font-bold text-accent flex items-center gap-1.5 uppercase tracking-widest">
                  {gasless ? (
                    <>
                      <Zap size={14} className="fill-accent" />
                      Gasless
                    </>
                  ) : (
                    <span className="text-white">On-Chain</span>
                  )}
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
              onClick={handleConfirmLending}
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

      {/* Single shared modal for basket items + repayment token */}
      <TokenSelectorModal
        open={tokenModalIndex !== null}
        onOpenChange={(open) => { if (!open) setTokenModalIndex(null) }}
        onSelect={handleTokenSelect}
        selectedAddress={activeSelectedAddress}
        balances={balances}
        showCustomOption={false}
      />
    </motion.div>
  )
}
