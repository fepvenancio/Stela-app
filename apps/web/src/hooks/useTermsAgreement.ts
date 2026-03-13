'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from '@starknet-react/core'
import { useWalletSign } from './useWalletSign'
import { getTermsAcknowledgmentTypedData } from '@fepvenancio/stela-sdk'
import { typedData as starknetTypedData } from 'starknet'
import { TERMS_VERSION, TERMS_HASH } from '@/lib/terms-config'
import { CHAIN_ID } from '@/lib/config'

const STORAGE_KEY = 'stela_terms_agreed'

interface TermsState {
  agreed: boolean
  loading: boolean
  signing: boolean
  error: string | null
}

/**
 * Hook to manage terms-of-use agreement per wallet address.
 *
 * Flow:
 * 1. Check localStorage for cached agreement (fast, avoids API call on every page load)
 * 2. If not cached, check D1 via API (handles wallet used on different device)
 * 3. If not agreed, show modal → user signs → POST to API → cache in localStorage
 */
export function useTermsAgreement() {
  const { address, status } = useAccount()
  const { signTypedData } = useWalletSign()
  const [state, setState] = useState<TermsState>({
    agreed: true, // default true so UI doesn't flash modal before checking
    loading: true,
    signing: false,
    error: null,
  })

  // Check agreement status when wallet connects
  useEffect(() => {
    if (status !== 'connected' || !address) {
      setState({ agreed: true, loading: false, signing: false, error: null })
      return
    }

    const checkAgreement = async () => {
      setState(s => ({ ...s, loading: true }))

      // 1. Check localStorage cache first
      const cached = getLocalAgreement(address)
      if (cached === TERMS_VERSION) {
        setState({ agreed: true, loading: false, signing: false, error: null })
        return
      }

      // 2. Check D1 via API
      try {
        const res = await fetch(`/api/terms?address=${encodeURIComponent(address)}`)
        if (res.ok) {
          const data = (await res.json()) as { agreed?: boolean }
          if (data.agreed) {
            setLocalAgreement(address, TERMS_VERSION)
            setState({ agreed: true, loading: false, signing: false, error: null })
            return
          }
        }
      } catch {
        // API failure — don't block the user, just show modal
      }

      // 3. Not agreed
      setState({ agreed: false, loading: false, signing: false, error: null })
    }

    checkAgreement()
  }, [address, status])

  const signTerms = useCallback(async () => {
    if (!address) return

    setState(s => ({ ...s, signing: true, error: null }))

    try {
      const agreedAt = BigInt(Math.floor(Date.now() / 1000))

      // Build SNIP-12 typed data
      const typed = getTermsAcknowledgmentTypedData({
        user: address,
        termsVersion: TERMS_VERSION,
        termsHash: TERMS_HASH,
        agreedAt,
        chainId: CHAIN_ID,
      })

      // Sign with wallet
      const signature = await signTypedData(typed)

      // Compute message hash for storage
      const messageHash = starknetTypedData.getMessageHash(typed, address)

      // POST to API for durable storage
      await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signatureR: signature[0],
          signatureS: signature[1],
          messageHash,
          agreedAt: agreedAt.toString(),
          chainId: CHAIN_ID,
        }),
      })

      // Cache locally
      setLocalAgreement(address, TERMS_VERSION)

      setState({ agreed: true, loading: false, signing: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signature failed'
      // If user rejected the signature, show a clear message
      const isRejected = message.includes('reject') || message.includes('abort') || message.includes('cancel')
      setState(s => ({
        ...s,
        signing: false,
        error: isRejected ? 'You must accept the terms to use Stela.' : message,
      }))
    }
  }, [address, signTypedData])

  return { ...state, signTerms }
}

// ── localStorage helpers ─────────────────────────────────────────────

function getLocalAgreement(address: string): string | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null
    const parsed = JSON.parse(data) as Record<string, string>
    return parsed[address.toLowerCase()] ?? null
  } catch {
    return null
  }
}

function setLocalAgreement(address: string, version: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const parsed = data ? (JSON.parse(data) as Record<string, string>) : {}
    parsed[address.toLowerCase()] = version
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // localStorage unavailable — agreement still stored in D1
  }
}
