'use client'

import { useState } from 'react'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign, type BatchSignItem } from '@/hooks/useBatchSign'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { formatTokenValue } from '@/lib/format'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { ChevronUp, ChevronDown, X, Wallet2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function BatchLendBar() {
  const { selected, clearAll, count, toggle } = useBatchSelection()
  const { batchSign, isPending } = useBatchSign()
  const { balances } = useTokenBalances()
  const [isExpanded, setIsExpanded] = useState(false)

  if (count === 0) return null

  // Aggregate required amounts per token
  const totals = new Map<string, bigint>()
  for (const [, inscription] of selected) {
    for (const asset of inscription.assets.filter((a) => a.asset_role === 'debt')) {
      const addr = asset.asset_address.toLowerCase()
      const val = BigInt(asset.value || '0')
      totals.set(addr, (totals.get(addr) ?? 0n) + val)
    }
  }

  const handleLend = async () => {
    const items: BatchSignItem[] = []
    for (const [, inscription] of selected) {
      const debtAssets = inscription.assets
        .filter((a) => a.asset_role === 'debt')
        .map((a) => ({ address: a.asset_address, value: a.value ?? '0' }))
      items.push({
        inscriptionId: inscription.id,
        bps: 10000,
        debtAssets,
      })
    }

    // Check balances
    for (const [tokenAddr, required] of totals) {
      const available = balances.get(tokenAddr) ?? 0n
      if (available < required) {
        toast.error('Insufficient balance', {
          description: `You need more tokens to fund all selected inscriptions.`,
        })
        return
      }
    }

    await batchSign(items)
    clearAll()
    setIsExpanded(false)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-fade-up">
      <div className="bg-surface/90 backdrop-blur-xl border border-star/30 rounded-3xl shadow-2xl overflow-hidden granite-noise">
        {/* Expanded View */}
        {isExpanded && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm tracking-widest text-star uppercase">Selected Inscriptions</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)} className="h-8 w-8 p-0 rounded-full">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {Array.from(selected.entries()).map(([id, item]) => (
                <div key={id} className="flex items-center justify-between p-2 rounded-xl bg-void/40 border border-edge/30 group">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-ash tracking-tighter uppercase">#{id.slice(2, 8)}</span>
                    <div className="flex gap-2">
                      {item.assets.filter(a => a.asset_role === 'debt').map((a, i) => {
                         const token = findTokenByAddress(a.asset_address)
                         return (
                           <div key={i} className="flex items-center gap-1">
                             <TokenAvatarByAddress address={a.asset_address} size={12} />
                             <span className="text-[10px] text-chalk font-medium">
                               {formatTokenValue(a.value, token?.decimals ?? 18)} {token?.symbol}
                             </span>
                           </div>
                         )
                      })}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggle(item)}
                    className="h-7 w-7 p-0 text-ash hover:text-nova hover:bg-nova/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator className="bg-edge/30" />

            <div className="space-y-2">
              <h4 className="text-[10px] text-dust uppercase tracking-widest font-semibold">Total Debt to Provide</h4>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(totals.entries()).map(([addr, total]) => {
                  const token = findTokenByAddress(addr)
                  const available = balances.get(addr) ?? 0n
                  const hasEnough = available >= total
                  return (
                    <div key={addr} className={`p-3 rounded-2xl border ${hasEnough ? 'bg-void/20 border-edge/30' : 'bg-nova/5 border-nova/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <TokenAvatarByAddress address={addr} size={16} />
                        <span className="text-xs font-bold text-chalk">{token?.symbol}</span>
                      </div>
                      <div className="text-sm font-display text-star">
                        {formatTokenValue(total.toString(), token?.decimals ?? 18)}
                      </div>
                      {!hasEnough && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-nova">
                          <Wallet2 className="w-3 h-3" />
                          <span>Insufficient: {formatTokenValue(available.toString(), token?.decimals ?? 18)} available</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Bar */}
        <div className="flex items-center gap-4 px-6 py-3 bg-star/5">
          <div 
            className="flex-1 cursor-pointer flex items-center gap-3"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="w-8 h-8 rounded-full bg-star/20 flex items-center justify-center text-star font-bold text-xs">
              {count}
            </div>
            <div>
               <div className="text-xs font-bold text-chalk uppercase tracking-tighter">
                 {count} Inscriptions Selected
               </div>
               <div className="text-[10px] text-dust flex items-center gap-1">
                 {isExpanded ? 'Click to collapse' : 'View summary and totals'}
                 {!isExpanded && <ChevronUp className="w-3 h-3" />}
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={isPending} className="text-ash hover:text-chalk h-9 px-3">
              Clear
            </Button>
            <Button 
              variant="gold" 
              size="sm" 
              onClick={handleLend} 
              disabled={isPending}
              className="h-9 px-6 rounded-xl font-bold shadow-lg shadow-star/20"
            >
              {isPending ? 'Signing...' : `Lend All`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
