'use client'

import { useState } from 'react'
import type { TakerIntent, MatchResponse } from '@fepvenancio/stela-sdk'
import { useEngineHealth } from '@/hooks/useEngineHealth'
import { MatchingEngineBanner } from '@/components/MatchingEngineBanner'
import { IntentForm } from '@/components/IntentForm'
import { MatchResultList } from '@/components/MatchResultList'
import { FillConfirmDialog } from '@/components/FillConfirmDialog'
import { Button } from '@/components/ui/button'

type Step = 'form' | 'results' | 'confirm' | 'success' | 'maker'

export default function IntentPage() {
  const { isOnline, isChecking } = useEngineHealth()

  const [step, setStep] = useState<Step>('form')
  const [intent, setIntent] = useState<TakerIntent | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null)

  // Loading state
  if (isChecking) {
    return (
      <div className="animate-fade-up max-w-2xl">
        <div className="mb-10">
          <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
            Express Your Intent
          </h1>
          <p className="text-dust leading-relaxed">Checking matching engine status...</p>
        </div>
      </div>
    )
  }

  // Engine offline
  if (!isOnline) {
    return (
      <div className="animate-fade-up max-w-2xl">
        <div className="mb-10">
          <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
            Express Your Intent
          </h1>
          <p className="text-dust leading-relaxed mb-6">
            Tell us what you need and we will find the best matching offers.
          </p>
        </div>
        <MatchingEngineBanner type="offline" />
      </div>
    )
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
            Express Your Intent
          </h1>
          <p className="text-dust leading-relaxed">
            Tell us what you need and we will find the best matching offers.
          </p>
        </div>
        {step !== 'form' && (
          <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30 w-fit">
            <span className="text-[10px] font-mono text-ash uppercase tracking-widest">
              Step: {step}
            </span>
          </div>
        )}
      </div>

      {/* Step state machine */}
      {step === 'form' && (
        <IntentForm
          onMatch={(newIntent, result) => {
            setIntent(newIntent)
            setMatchResult(result)
            setStep(result.matches.length > 0 ? 'results' : 'maker')
          }}
        />
      )}

      {step === 'results' && matchResult && intent && (
        <MatchResultList
          result={matchResult}
          intent={intent}
          onFill={() => setStep('confirm')}
          onMake={() => setStep('maker')}
        />
      )}

      {step === 'confirm' && matchResult && intent && (
        <FillConfirmDialog
          result={matchResult}
          intent={intent}
          onSuccess={() => setStep('success')}
          onBack={() => setStep('results')}
        />
      )}

      {step === 'success' && (
        <div className="rounded-2xl border border-star/30 bg-star/5 p-8 text-center space-y-4">
          <h3 className="text-lg font-display uppercase tracking-widest text-star">
            Order filled successfully!
          </h3>
          <p className="text-xs text-dust">
            Your transaction has been submitted. Check your portfolio for status updates.
          </p>
          <Button
            variant="gold"
            onClick={() => {
              setStep('form')
              setIntent(null)
              setMatchResult(null)
            }}
            className="uppercase tracking-widest"
          >
            New Intent
          </Button>
        </div>
      )}

      {step === 'maker' && (
        <div className="rounded-2xl border border-edge/30 bg-surface/20 p-8 text-center space-y-4">
          <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
            Maker Order Form
          </h3>
          <p className="text-xs text-dust">
            Maker order form coming in next plan.
          </p>
          <Button
            variant="ghost"
            onClick={() => setStep('form')}
            className="uppercase tracking-widest text-ash hover:text-chalk"
          >
            Back to Form
          </Button>
        </div>
      )}
    </div>
  )
}
