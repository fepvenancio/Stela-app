'use client'

import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign, type BatchSignItem } from '@/hooks/useBatchSign'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function BatchLendBar() {
  const { selected, clearAll, count } = useBatchSelection()
  const { batchSign, isPending } = useBatchSign()
  const { balances } = useTokenBalances()

  if (count === 0) return null

  const handleLend = async () => {
    const items: BatchSignItem[] = []
    // Aggregate required amounts per token to check balances
    const requiredMap = new Map<string, bigint>()

    for (const [, inscription] of selected) {
      const debtAssets = inscription.assets
        .filter((a) => a.asset_role === 'debt')
        .map((a) => ({ address: a.asset_address, value: a.value ?? '0' }))
      items.push({
        inscriptionId: inscription.id,
        bps: 10000,
        debtAssets,
      })
      for (const asset of debtAssets) {
        const amount = BigInt(asset.value || '0')
        if (amount <= 0n) continue
        const key = asset.address.toLowerCase()
        requiredMap.set(key, (requiredMap.get(key) ?? 0n) + amount)
      }
    }

    // Check if user has enough of each token
    for (const [tokenAddr, required] of requiredMap) {
      const available = balances.get(tokenAddr) ?? 0n
      if (available < required) {
        toast.error('Insufficient balance', {
          description: `You need more tokens to fund all ${count} selected inscriptions. Try selecting fewer.`,
        })
        return
      }
    }

    await batchSign(items)
    clearAll()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-surface/95 backdrop-blur-md border border-star/30 rounded-full shadow-lg">
      <span className="text-sm text-chalk font-medium">
        {count} selected
      </span>
      <Button variant="outline" size="sm" onClick={clearAll} disabled={isPending}>
        Clear
      </Button>
      <Button variant="gold" size="sm" onClick={handleLend} disabled={isPending}>
        {isPending ? 'Signing...' : `Lend to All (${count})`}
      </Button>
    </div>
  )
}
