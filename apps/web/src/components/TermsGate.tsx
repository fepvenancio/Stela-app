'use client'

import { useTermsAgreement } from '@/hooks/useTermsAgreement'
import { TERMS_TEXT, TERMS_VERSION } from '@/lib/terms-config'
import { Button } from '@/components/ui/button'

/**
 * Full-screen terms gate overlay. Shown when a connected wallet
 * hasn't signed the current terms version.
 *
 * Does NOT block:
 * - Disconnected users (they can browse freely)
 * - Users who already signed (cached in localStorage + D1)
 * - Static pages (/terms, /privacy, /docs, /faq)
 */
export function TermsGate() {
  const { agreed, loading, signing, error, signTerms } = useTermsAgreement()

  // Don't show gate while checking or if already agreed
  if (loading || agreed) return null

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505]/98 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface border border-border/30 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/20">
          <h2 className="font-bold text-xl tracking-widest text-accent uppercase">
            Terms of Use
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Sign with your wallet to acknowledge and continue — v{TERMS_VERSION}
          </p>
        </div>

        {/* Terms content */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-3 text-sm text-gray-400/90 leading-relaxed font-mono">
            {TERMS_TEXT.split('\n\n').map((paragraph, i) => (
              <p key={i} className={i === 0 ? 'text-white font-semibold text-xs tracking-wider uppercase' : ''}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20 space-y-3">
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400/60">
              This signature is free and does not trigger a transaction.
            </p>
            <Button
              variant="default"
              onClick={signTerms}
              disabled={signing}
              className="shrink-0 min-w-[140px]"
            >
              {signing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing...
                </span>
              ) : (
                'Sign & Accept'
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-400/40 text-center">
            By signing, you confirm you have read and agree to the{' '}
            <a href="/terms" target="_blank" className="underline hover:text-gray-400/60">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" className="underline hover:text-gray-400/60">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
