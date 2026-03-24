'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  X,
  ChevronDown,
  Zap,
  ArrowLeftRight,
  Layers,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { getTokensForNetwork } from '@fepvenancio/stela-sdk'
import type { TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import { TokenAvatar } from '@/components/TokenAvatar'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { useTokenBalances } from '@/hooks/useTokenBalances'

interface AssetEntry {
  token: TokenInfo
  amount: string
}

interface InscribeData {
  name: string
  assets: AssetEntry[]
  duration: number
  lendEnabled: boolean
  swapEnabled: boolean
}

export default function BorrowPage() {
  const tokens = useMemo(() => getTokensForNetwork(NETWORK), [])
  const { balances } = useTokenBalances()

  const [step, setStep] = useState(1)
  const [isSuccess, setIsSuccess] = useState(false)
  const [data, setData] = useState<InscribeData>({
    name: '',
    assets: [{ token: tokens[0], amount: '' }],
    duration: 0,
    lendEnabled: true,
    swapEnabled: true,
  })

  // null = closed, number = asset index being edited
  const [assetModalIndex, setAssetModalIndex] = useState<number | null>(null)

  const goBack = () => setStep((s) => s - 1)
  const goNext = () => {
    if (step < 4) {
      setStep((s) => s + 1)
    } else {
      toast('Coming soon')
    }
  }

  const addAsset = () => {
    setData((prev) => ({
      ...prev,
      assets: [...prev.assets, { token: tokens[0], amount: '' }],
    }))
  }

  const updateAssetAmount = (idx: number, amount: string) => {
    setData((prev) => ({
      ...prev,
      assets: prev.assets.map((a, i) => (i === idx ? { ...a, amount } : a)),
    }))
  }

  const activeAssetToken = assetModalIndex !== null ? data.assets[assetModalIndex]?.token : undefined
  const activeSelectedAddress = activeAssetToken?.addresses[NETWORK] ?? ''

  const handleAssetTokenSelect = (token: TokenInfo) => {
    if (assetModalIndex === null) return
    setData((prev) => ({
      ...prev,
      assets: prev.assets.map((a, i) => (i === assetModalIndex ? { ...a, token } : a)),
    }))
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-surface w-full max-w-xl rounded-[3rem] border border-border shadow-2xl overflow-hidden"
      >
        <div className="p-12">
          {/* Header with progress dots */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                <Sparkles className="text-accent" size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Inscribe</h2>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        step >= s ? 'w-6 bg-accent' : 'w-2 bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-8"
                >
                  <div className="w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                    >
                      <Check className="text-green-500" size={64} />
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-green-500/30"
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                      Inscription Complete
                    </h3>
                    <p className="text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Your Stela has been etched into the StarkNet ledger. It is now a permanent
                      digital artifact.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsSuccess(false)
                      setStep(1)
                      setData({
                        name: '',
                        assets: [{ token: tokens[0], amount: '' }],
                        duration: 0,
                        lendEnabled: true,
                        swapEnabled: true,
                      })
                    }}
                    className="bg-white text-black px-12 py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-gray-200 transition-all shadow-2xl shadow-white/5 cursor-pointer"
                  >
                    Create Another
                  </button>
                </motion.div>
              ) : (
                <>
                  {/* Step 1: Identity */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Identity of the Artifact
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          Give your Stela a unique name. This will be etched into the protocol
                          forever.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                          Artifact Name
                        </label>
                        <input
                          type="text"
                          value={data.name}
                          onChange={(e) => setData({ ...data, name: e.target.value })}
                          placeholder="e.g. Genesis Vault"
                          className="w-full bg-white/[0.02] border border-border rounded-2xl p-6 outline-none focus:border-accent/40 transition-all text-lg placeholder:text-gray-800 font-bold"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Assets */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Select Underlying Assets
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          Choose the tokens you want to lock within this Stela. You can add multiple
                          assets.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {data.assets.map((asset, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-4">
                            <div className="bg-white/[0.02] rounded-2xl p-5 flex items-center justify-between border border-border group focus-within:border-accent/40 transition-all">
                              <button
                                type="button"
                                onClick={() => setAssetModalIndex(idx)}
                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                              >
                                <TokenAvatar token={asset.token} size={20} />
                                <span className="font-bold text-sm text-white truncate">
                                  {asset.token.symbol}
                                </span>
                              </button>
                              <ChevronDown
                                size={16}
                                className="text-gray-700 shrink-0 pointer-events-none"
                              />
                            </div>
                            <div className="bg-white/[0.02] rounded-2xl p-5 flex items-center justify-between border border-border group focus-within:border-accent/40 transition-all">
                              <input
                                type="number"
                                value={asset.amount}
                                onChange={(e) => updateAssetAmount(idx, e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent font-mono font-bold text-lg outline-none w-full placeholder:text-gray-800"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={addAsset}
                          className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:border-accent/40 hover:text-accent transition-all cursor-pointer"
                        >
                          + Add Another Asset
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Configuration */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Configuration &amp; Permissions
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          Set the lock duration. If set to 0, your Stela remains liquid, allowing
                          for instant swaps and lending.
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 px-1">
                            Lock Duration (Days)
                          </label>
                          <div className="bg-white/[0.02] rounded-2xl p-6 flex items-center justify-between border border-border group focus-within:border-accent/40 transition-all">
                            <input
                              type="number"
                              value={data.duration}
                              onChange={(e) =>
                                setData({ ...data, duration: Number(e.target.value) })
                              }
                              className="bg-transparent font-mono font-bold text-2xl outline-none w-full"
                            />
                            <span
                              className={`text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                                data.duration === 0
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-orange-500/10 text-orange-500'
                              }`}
                            >
                              {data.duration === 0 ? 'LIQUID' : 'LOCKED'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() =>
                              setData({ ...data, lendEnabled: !data.lendEnabled })
                            }
                            className={`p-6 rounded-2xl border transition-all flex flex-col gap-3 cursor-pointer ${
                              data.lendEnabled
                                ? 'bg-accent/10 border-accent/40'
                                : 'bg-white/[0.02] border-border opacity-50'
                            }`}
                          >
                            <Zap
                              size={20}
                              className={data.lendEnabled ? 'text-accent' : 'text-gray-600'}
                            />
                            <div className="text-left">
                              <span className="text-xs font-bold text-white block">
                                Lend Enabled
                              </span>
                              <span className="text-[10px] text-gray-500">
                                Allow as collateral
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() =>
                              setData({ ...data, swapEnabled: !data.swapEnabled })
                            }
                            className={`p-6 rounded-2xl border transition-all flex flex-col gap-3 cursor-pointer ${
                              data.swapEnabled
                                ? 'bg-accent/10 border-accent/40'
                                : 'bg-white/[0.02] border-border opacity-50'
                            }`}
                          >
                            <ArrowLeftRight
                              size={20}
                              className={data.swapEnabled ? 'text-accent' : 'text-gray-600'}
                            />
                            <div className="text-left">
                              <span className="text-xs font-bold text-white block">
                                Swap Enabled
                              </span>
                              <span className="text-[10px] text-gray-500">
                                Allow instant exit
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Review */}
                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-10"
                    >
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 bg-accent/10 rounded-[2rem] flex items-center justify-center mx-auto border border-accent/20 shadow-2xl shadow-accent/10">
                          <Layers className="text-accent" size={48} />
                        </div>
                        <h3 className="text-3xl font-bold text-white tracking-tight">
                          Finalize Inscription
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                          Review your Stela parameters. Once inscribed, the core structure is
                          immutable.
                        </p>
                      </div>

                      <div className="bg-white/[0.02] rounded-[2.5rem] border border-border p-10 space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                            Artifact Name
                          </span>
                          <span className="text-base font-bold text-white tracking-tight">
                            {data.name || 'Untitled Artifact'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                            Locked Assets
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {data.assets.map((a, i) => (
                                <div
                                  key={i}
                                  className="w-8 h-8 rounded-full bg-surface border-2 border-surface flex items-center justify-center overflow-hidden"
                                >
                                  <TokenAvatar token={a.token} size={28} />
                                </div>
                              ))}
                            </div>
                            <span className="font-mono font-bold text-white text-sm">
                              {data.assets.length} Asset
                              {data.assets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                            Duration
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                data.duration === 0 ? 'bg-green-500' : 'bg-orange-500'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                data.duration === 0 ? 'text-green-500' : 'text-orange-500'
                              }`}
                            >
                              {data.duration === 0
                                ? 'Liquid Artifact'
                                : `${data.duration} Days Lock`}
                            </span>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                              Network
                            </span>
                            <span className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1">
                              StarkNet {NETWORK === 'sepolia' ? 'Sepolia' : 'Mainnet'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          {!isSuccess && (
            <div className="flex items-center gap-4 mt-12 px-12 pb-12">
              {step > 1 && (
                <button
                  onClick={goBack}
                  className="flex-1 bg-white/5 text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all hover:bg-white/10 border border-white/5 cursor-pointer"
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="flex-[2] bg-white text-black py-5 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all hover:bg-gray-200 shadow-2xl shadow-white/5 flex items-center justify-center gap-3 cursor-pointer"
              >
                {step === 4 ? (
                  <>
                    <Sparkles size={18} />
                    Finalize Inscription
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Single shared modal for all asset token selections */}
      <TokenSelectorModal
        open={assetModalIndex !== null}
        onOpenChange={(open) => { if (!open) setAssetModalIndex(null) }}
        onSelect={handleAssetTokenSelect}
        selectedAddress={activeSelectedAddress}
        balances={balances}
        showCustomOption={false}
      />
    </div>
  )
}
