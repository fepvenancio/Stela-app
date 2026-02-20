'use client'

import { useState, useEffect } from 'react'

interface AgreementRow {
  id: string
  creator: string
  borrower: string | null
  lender: string | null
  status: string
  issued_debt_percentage: string
  multi_lender: boolean
  duration: string
  deadline: string
  signed_at: string | null
  debt_asset_count: number
  interest_asset_count: number
  collateral_asset_count: number
  created_at_ts: string
}

export function useAgreements(params?: { status?: string; address?: string; page?: number }) {
  const [data, setData] = useState<AgreementRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.address) searchParams.set('address', params.address)
    if (params?.page) searchParams.set('page', String(params.page))

    setIsLoading(true)
    fetch(`/api/agreements?${searchParams}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!Array.isArray(json)) throw new Error('Unexpected response format')
        setData(json)
      })
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [params?.status, params?.address, params?.page])

  return { data, isLoading, error }
}
