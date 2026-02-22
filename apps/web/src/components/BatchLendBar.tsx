'use client'

import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useBatchSign, type BatchSignItem } from '@/hooks/useBatchSign'
import { Button } from '@/components/ui/button'

export function BatchLendBar() {
  const { selected, clearAll, count } = useBatchSelection()
  const { batchSign, isPending } = useBatchSign()

  if (count === 0) return null

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
