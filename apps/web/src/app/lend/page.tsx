'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Plus,
  Trash2,
  ChevronDown,
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

  // Debt assets (what the lender offers)
  const [debtBasket, setDebtBasket] = useState<BasketItem[]>([
    { token: tokens[0], amount: '' },
  ])
  // Interest assets (what the lender wants back as interest)
  const [interestBasket, setInterestBasket] = useState<BasketItem[]>([
    { token: tokens[1] ?? tokens[0], amount: '' },
  ])
  const [duration, setDuration] = useState('')
  const [gasless, setGasless] = useState(true)

  // Modal state: null=closed, 'debt-N'=debt basket idx, 'interest-N'=interest basket idx
  const [modalTarget, setModalTarget] = useState<string | null>(null)

  /* ── Debt basket helpers ────────────────────────── */
  const addDebt = () => setDebtBasket(prev => [...prev, { token: tokens[0], amount: '' }])
  const removeDebt = (i: number) => setDebtBasket(prev => prev.filter((_, idx) => idx !== i))
  const updateDebtAmount = (i: number, amount: string) =>
    setDebtBasket(prev => prev.map((item, idx) => idx === i ? { ...item, amount } : item))

  /* ── Interest basket helpers ────────────────────── */
  const addInterest = () => setInterestBasket(prev => [...prev, { token: tokens[0], amount: '' }])
  const removeInterest = (i: number) => setInterestBasket(prev => prev.filter((_, idx) => idx !== i))
  const updateInterestAmount = (i: number, amount: string) =>
    setInterestBasket(prev => prev.map((item, idx) => idx === i ? { ...item, amount } : item))

  const navigateToBorrow = () => router.push('/borrow')

  const getTokenBalance = (token: TokenInfo): string => {
    const addr = token.addresses[NETWORK]?.toLowerCase() ?? ''
    const raw = balances.get(addr)
    return raw !== undefined ? formatTokenValue(raw.toString(), token.decimals) : '--'
  }

  const fillMax = (token: TokenInfo, setter: (val: string) => void) => {
    const addr = token.addresses[NETWORK]?.toLowerCase() ?? ''
    const raw = balances.get(addr)
    if (raw !== undefined && raw > 0n) {
      setter((Number(raw) / 10 ** token.decimals).toString())
    }
  }

  const handleConfirmLending = () => {
    if (status !== 'connected') { toast.error('Connect wallet first'); return }
    const filledDebt = debtBasket.filter(b => b.amount && Number(b.amount) > 0)
    if (filledDebt.length === 0) { toast.error('Enter an amount for at least one debt asset'); return }
    const filledInterest = interestBasket.filter(b => b.amount && Number(b.amount) > 0)
    if (filledInterest.length === 0) { toast.error('Enter an amount for at least one interest asset'); return }
    toast('Signing order...')
    router.push('/trade?mode=lend')
  }

  /* ── Modal token selection ────────────────────── */
  const getModalToken = (): TokenInfo | undefined => {
    if (!modalTarget) return undefined
    const [type, idxStr] = modalTarget.split('-')
    const idx = Number(idxStr)
    if (type === 'debt') return debtBasket[idx]?.token
    if (type === 'interest') return interestBasket[idx]?.token
    return undefined
  }

  const handleTokenSelect = (token: TokenInfo) => {
    if (!modalTarget) return
    const [type, idxStr] = modalTarget.split('-')
    const idx = Number(idxStr)
    if (type === 'debt') {
      setDebtBasket(prev => prev.map((item, i) => i === idx ? { ...item, token } : item))
    } else if (type === 'interest') {
      setInterestBasket(prev => prev.map((item, i) => i === idx ? { ...item, token } : item))
    }
  }

  const activeToken = getModalToken()

  /* ── Render a basket row ────────────────────── */
  const renderRow = (
    item: BasketItem,
    idx: number,
    list: BasketItem[],
    modalPrefix: string,
    updateAmount: (i: number, val: string) => void,
    removeItem: (i: number) => void,
  ) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={`${modalPrefix}-${idx}`}
      className="bg-white/[0.01] rounded-2xl p-4 border border-border group hover:border-accent/20 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center border border-border shadow-inner shrink-0">
            <TokenAvatar token={item.token} size={24} />
          </div>
          <button
            type="button"
            onClick={() => setModalTarget(`${modalPrefix}-${idx}`)}
            className="flex items-center gap-1 cursor-pointer"
          >
            <span className="font-bold text-sm text-white">{item.token.symbol}</span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fillMax(item.token, (v) => updateAmount(idx, v))}
            className="text-[9px] font-bold text-accent hover:text-white transition-colors cursor-pointer"
          >
            MAX
          </button>
          <input
            type="number" inputMode="decimal" step="any"
            placeholder="0.00"
            value={item.amount}
            onChange={(e) => updateAmount(idx, e.target.value)}
            className="bg-transparent text-right font-mono text-base font-bold outline-none w-28 placeholder:text-gray-800"
          />
          {list.length > 1 && (
            <button
              onClick={() => removeItem(idx)}
              className="text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 pl-13 text-[10px] text-gray-500 pl-[52px]">
        Balance: {getTokenBalance(item.token)}
      </div>
    </motion.div>
  )

  /* ── Summary stats ────────────────────── */
  const filledDebtCount = debtBasket.filter(b => b.amount && Number(b.amount) > 0).length
  const filledInterestCount = interestBasket.filter(b => b.amount && Number(b.amount) > 0).length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Lend Assets</h1>
        <p className="text-gray-500 mt-1 font-medium text-sm">
          Create a liquid Stela to earn interest on your assets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
        {/* Left column — form */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-2xl flex-1 flex flex-col">
            {/* Tab toggle */}
            <div className="flex p-1.5 bg-white/[0.02] m-6 rounded-xl border border-border">
              <button className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.2em] bg-white text-black shadow-xl">
                Lend Assets
              </button>
              <button
                onClick={navigateToBorrow}
                className="flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                Borrow Assets
              </button>
            </div>

            <div className="px-6 pb-6 space-y-6 flex-1">
              {/* Debt basket */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold tracking-tight text-white">Debt Assets</h3>
                  <button onClick={addDebt} className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors cursor-pointer">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {debtBasket.map((item, idx) => renderRow(item, idx, debtBasket, 'debt', updateDebtAmount, removeDebt))}
                </div>
              </div>

              {/* Interest basket */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold tracking-tight text-white">Interest Assets</h3>
                  <button onClick={addInterest} className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors cursor-pointer">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {interestBasket.map((item, idx) => renderRow(item, idx, interestBasket, 'interest', updateInterestAmount, removeInterest))}
                </div>
              </div>

              {/* Duration & Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Duration
                  </label>
                  <div className="bg-white/[0.01] rounded-xl h-12 px-4 flex items-center gap-3 border border-border">
                    <Clock size={14} className="text-gray-500 shrink-0" />
                    <input
                      type="number" inputMode="decimal" step="1" min="0"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="7"
                      className="bg-transparent flex-1 text-right font-mono text-sm font-bold outline-none placeholder:text-gray-800"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                    Funding Mode
                  </label>
                  <div className="bg-white/[0.01] rounded-xl h-12 px-1 flex items-center border border-border">
                    <button
                      type="button"
                      onClick={() => setGasless(true)}
                      className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-[0.12em] transition-all cursor-pointer ${
                        gasless
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      <Wifi size={12} />
                      Gasless
                    </button>
                    <button
                      type="button"
                      onClick={() => setGasless(false)}
                      className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-[0.12em] transition-all cursor-pointer ${
                        !gasless
                          ? 'bg-white/10 text-white border border-white/10'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      <WifiOff size={12} />
                      On-Chain
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — summary */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-surface rounded-2xl border border-border p-6 flex-1 flex flex-col justify-between sticky top-24">
            <div className="space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                Transaction Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Debt Assets</span>
                  <span className="font-mono font-bold text-sm text-white">{filledDebtCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Interest Assets</span>
                  <span className="font-mono font-bold text-sm text-white">{filledInterestCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Protocol Fee</span>
                  <span className="font-bold text-sm text-white">0.25%</span>
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
                      <><Zap size={14} className="fill-accent" />Gasless</>
                    ) : (
                      <span className="text-white">On-Chain</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="bg-white/[0.02] rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center gap-2 text-accent">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Secure P2P Match</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Your offer will be listed on the Stela P2P marketplace. Funds are held in a secure StarkNet smart contract.
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirmLending}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all hover:bg-gray-200 flex items-center justify-center gap-3 group shadow-xl shadow-white/5 cursor-pointer mt-6"
            >
              Confirm Lending
              <ArrowLeftRight size={16} className="group-hover:rotate-180 transition-transform duration-1000" />
            </button>
          </div>
        </div>
      </div>

      {/* Token selector modal */}
      <TokenSelectorModal
        open={modalTarget !== null}
        onOpenChange={(open) => { if (!open) setModalTarget(null) }}
        onSelect={handleTokenSelect}
        selectedAddress={activeToken?.addresses[NETWORK] ?? ''}
        balances={balances}
        showCustomOption={false}
      />
    </motion.div>
  )
}
