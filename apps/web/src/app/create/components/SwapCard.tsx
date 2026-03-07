'use client'

import { useState } from 'react'
import { ChevronDown, ArrowDown, Info, Settings2, Plus } from 'lucide-react'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { TokenAvatar } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDisplayAmount } from '@/lib/format'
import type { AssetInputValue } from '@/components/AssetInput'
import { AddAssetModal } from './AddAssetModal'

interface SwapCardProps {
  orderType: 'lending' | 'swap'
  mode: 'offchain' | 'onchain'
  multiLender: boolean
  debtAssets: AssetInputValue[]
  collateralAssets: AssetInputValue[]
  interestAssets: AssetInputValue[]
  duration: string
  deadline: string
  onAddAsset: (asset: AssetInputValue, role: 'debt' | 'collateral' | 'interest') => void
  onRemoveAsset: (role: 'debt' | 'collateral' | 'interest', index: number) => void
  onSubmit: () => void
  isPending: boolean
  submitButtonText: string
  balances?: Map<string, bigint>
  useCustomDuration: boolean
  setUseCustomDuration: (v: boolean) => void
  durationPreset: string
  setDurationPreset: (v: string) => void
  customDurationValue: string
  setCustomDurationValue: (v: string) => void
  customDurationUnit: number
  setCustomDurationUnit: (v: number) => void
  deadlinePreset: string
  setDeadlinePreset: (v: string) => void
  formatDurationHuman: (s: number) => string
  formatTimestamp: (ts: bigint) => string
  roiInfo: { yieldPct: string; symbol: string } | null
}

export function SwapCard(props: SwapCardProps) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [activeRole, setActiveRole] = useState<'debt' | 'collateral' | 'interest'>('debt')
  const isSwap = props.orderType === 'swap'

  const handleOpenAdd = (role: 'debt' | 'collateral' | 'interest') => {
    setActiveRole(role)
    setAddModalOpen(true)
  }

  return (
    <div className="w-full max-w-[460px] animate-fade-in">
      <div className="relative group">
        {/* Decorative background glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-b from-star/20 to-transparent rounded-[32px] blur opacity-50 group-hover:opacity-75 transition duration-1000"></div>
        
        <div className="relative bg-void/90 backdrop-blur-2xl border border-star/20 rounded-[32px] p-1 shadow-2xl overflow-hidden">
          
          {/* Top Slot: Intent (Borrow/Swap Out) */}
          <div className="bg-surface/20 rounded-t-[28px] p-6 pb-8 space-y-4 border-b border-edge/10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-display tracking-[0.2em] text-dust uppercase">You Receive</span>
              {props.balances && props.debtAssets[0] && (
                <span className="text-[10px] font-mono text-ash">
                  Balance: {formatDisplayAmount(props.balances.get(props.debtAssets[0].asset.toLowerCase())?.toString() || '0')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {props.debtAssets.length === 0 ? (
                <button 
                  onClick={() => handleOpenAdd('debt')}
                  className="flex-1 flex items-center justify-between group/btn"
                >
                  <span className="text-4xl font-display text-ash/40 group-hover/btn:text-ash transition-colors">0.0</span>
                  <div className="bg-star text-void px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs tracking-widest shadow-lg shadow-star/10 hover:scale-105 active:scale-95 transition-all">
                    SELECT ASSET
                    <ChevronDown size={14} strokeWidth={3} />
                  </div>
                </button>
              ) : (
                <div className="flex-1 space-y-3">
                  {props.debtAssets.map((asset, i) => {
                    const token = findTokenByAddress(asset.asset)
                    return (
                      <div key={i} className="flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                        <span className="text-4xl font-display text-chalk leading-none truncate max-w-[200px]">
                          {asset.value || '0.0'}
                        </span>
                        <button 
                          onClick={() => props.onRemoveAsset('debt', i)}
                          className="bg-void/50 border border-star/20 px-3 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs hover:border-star/50 transition-colors"
                        >
                          {token ? <TokenAvatar token={token} size={20} /> : <div className="w-5 h-5 bg-edge rounded-full" />}
                          <span className="tracking-widest">{token?.symbol || 'CUSTOM'}</span>
                          <Plus size={14} className="rotate-45 text-ash" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center Connection (Arrow) */}
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="bg-void border-2 border-star/30 p-2.5 rounded-2xl shadow-[0_0_15px_rgba(232,168,37,0.2)]">
              <ArrowDown size={18} className="text-star" strokeWidth={3} />
            </div>
          </div>

          {/* Bottom Slot: Commitment (Collateral/Swap In) */}
          <div className="bg-void/40 rounded-b-[28px] p-6 pt-10 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-display tracking-[0.2em] text-dust uppercase">You Lock</span>
              {props.balances && props.collateralAssets[0] && (
                <span className="text-[10px] font-mono text-ash">
                  Balance: {formatDisplayAmount(props.balances.get(props.collateralAssets[0].asset.toLowerCase())?.toString() || '0')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {props.collateralAssets.length === 0 ? (
                <button 
                  onClick={() => handleOpenAdd('collateral')}
                  className="flex-1 flex items-center justify-between group/btn"
                >
                  <span className="text-4xl font-display text-ash/40 group-hover/btn:text-ash transition-colors">0.0</span>
                  <div className="bg-surface/60 border border-edge/40 text-chalk px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs tracking-widest hover:border-star/40 transition-all">
                    SELECT ASSET
                    <ChevronDown size={14} strokeWidth={3} />
                  </div>
                </button>
              ) : (
                <div className="flex-1 space-y-3">
                  {props.collateralAssets.map((asset, i) => {
                    const token = findTokenByAddress(asset.asset)
                    return (
                      <div key={i} className="flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                        <span className="text-4xl font-display text-chalk leading-none truncate max-w-[200px]">
                          {asset.asset_type.includes('ERC721') ? `#${asset.token_id}` : asset.value || '0.0'}
                        </span>
                        <button 
                          onClick={() => props.onRemoveAsset('collateral', i)}
                          className="bg-void/50 border border-star/20 px-3 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs hover:border-star/50 transition-colors"
                        >
                          {token ? <TokenAvatar token={token} size={20} /> : <div className="w-5 h-5 bg-edge rounded-full" />}
                          <span className="tracking-widest">{token?.symbol || 'CUSTOM'}</span>
                          <Plus size={14} className="rotate-45 text-ash" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Agreement Terms Overlay (Conditional) */}
            <div className="pt-4 mt-2 border-t border-edge/10 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 group/info cursor-help">
                  <span className="text-[9px] font-display tracking-[0.2em] text-ash uppercase">Agreement Terms</span>
                  <Info size={10} className="text-ash group-hover/info:text-star transition-colors" />
                </div>
                {!isSwap && (
                  <button 
                    onClick={() => props.setUseCustomDuration(!props.useCustomDuration)}
                    className="text-[9px] font-display tracking-widest text-star uppercase hover:text-star-bright transition-colors"
                  >
                    {props.useCustomDuration ? '[ Use Presets ]' : '[ Custom ]'}
                  </button>
                )}
              </div>

              {!isSwap && (
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '1D', sec: '86400' },
                    { label: '7D', sec: '604800' },
                    { label: '30D', sec: '2592000' },
                    { label: '90D', sec: '7776000' }
                  ].map((p) => (
                    <button
                      key={p.sec}
                      onClick={() => props.setDurationPreset(p.sec)}
                      className={`py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                        props.durationPreset === p.sec 
                          ? 'border-star/40 bg-star/10 text-star' 
                          : 'border-edge/20 text-ash hover:border-edge/50'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              )}

              {/* Estimated ROI Line */}
              {props.roiInfo && (
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-dust">Return on commitment</span>
                  <span className="text-[10px] font-bold text-aurora">+{props.roiInfo.yieldPct}% {props.roiInfo.symbol}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Area */}
          <div className="p-1">
            <Button
              variant="gold"
              className="w-full h-20 rounded-[26px] text-xl font-display tracking-[0.3em] shadow-xl shadow-star/5 hover:shadow-star/20 transition-all group/submit"
              onClick={props.onSubmit}
              disabled={props.isPending}
            >
              {props.isPending ? (
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 border-2 border-void border-t-transparent animate-spin rounded-full" />
                  PROCESSING
                </div>
              ) : (
                <span className="group-hover/submit:scale-105 transition-transform duration-300">
                  {props.submitButtonText.toUpperCase()}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Global Config HUD (Floating below) */}
      <div className="mt-8 flex justify-center items-center gap-10 px-4 py-3 bg-void/40 backdrop-blur border border-edge/30 rounded-2xl text-[9px] font-display tracking-[0.2em] text-ash uppercase">
        <div className="flex items-center gap-3">
          <span className="text-dust/50">Logic</span>
          <button onClick={() => {}} className="text-star hover:text-star-bright transition-colors">
            {props.multiLender ? 'Multi-Lender' : 'Single Lender'}
          </button>
        </div>
        <div className="w-1 h-1 bg-edge rounded-full" />
        <div className="flex items-center gap-3">
          <span className="text-dust/50">Execution</span>
          <button onClick={() => {}} className="text-star hover:text-star-bright transition-colors">
            {props.mode === 'offchain' ? 'Gasless' : 'On-Chain'}
          </button>
        </div>
      </div>

      <AddAssetModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={props.onAddAsset}
        balances={props.balances}
        availableRoles={isSwap ? ['debt', 'collateral'] : ['debt', 'collateral', 'interest']}
      />
    </div>
  )
}
