'use client'

import { useState, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { useQueryClient } from '@tanstack/react-query'
import { normalizeAddress } from '@/lib/address'
import { OrderListRow } from '@/components/OrderListRow'
import { useWalletSign } from '@/hooks/useWalletSign'
import { getCancelOrderTypedData } from '@/lib/offchain'
import { CHAIN_ID } from '@/lib/config'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import type { OrderRow } from '@/hooks/useOrders'

interface Props {
  order: OrderRow
}

export function PortfolioOrderRow({ order }: Props) {
  const { address } = useAccount()
  const normalized = address ? normalizeAddress(address) : ''
  const queryClient = useQueryClient()
  const { signTypedData } = useWalletSign()
  const [isPending, setIsPending] = useState(false)

  const isBorrower = normalizeAddress(order.borrower) === normalized
  const canCancel = isBorrower && order.status === 'pending'

  const handleCancel = useCallback(async () => {
    if (!address) return
    setIsPending(true)
    try {
      // Step 1: Build SNIP-12 CancelOrder typed data
      const cancelTypedData = getCancelOrderTypedData(order.id, CHAIN_ID)

      // Step 2: Sign with wallet
      const sig = await signTypedData(cancelTypedData)
      const sigArray = sig.map(String)

      // Step 3: Send signed cancellation to API
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower: address,
          signature: sigArray,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Cancel failed' }))
        throw new Error((err as Record<string, string>).error || 'Cancel failed')
      }
      toast.success('Order cancelled')
      // Invalidate all portfolio queries to refresh
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    } catch (err) {
      toast.error('Failed to cancel', { description: getErrorMessage(err) })
    } finally {
      setIsPending(false)
    }
  }, [address, order.id, queryClient, signTypedData])

  return (
    <OrderListRow
      order={order}
      onAction={canCancel ? handleCancel : undefined}
      actionPending={isPending}
      actionLabel={canCancel ? 'Cancel Order' : undefined}
    />
  )
}
