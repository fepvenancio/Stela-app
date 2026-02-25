'use client'

import { useState, useCallback } from 'react'
import type { TakerIntent, MatchResponse } from '@fepvenancio/stela-sdk'
import { useMatchIntent } from '@/hooks/useMatchIntent'
import { MatchingEngineBanner } from '@/components/MatchingEngineBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'

interface IntentFormProps {
  onMatch: (intent: TakerIntent, result: MatchResponse) => void
}

/**
 * IntentForm — taker intent form with action toggle, inscription selector,
 * and BPS input. Submits to the matching engine via useMatchIntent.
 */
export function IntentForm({ onMatch }: IntentFormProps) {
  const [action, setAction] = useState<'Borrow' | 'Lend'>('Borrow')
  const [inscriptionId, setInscriptionId] = useState('')
  const [bps, setBps] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const { matchIntent, isLoading, error, engineOffline } = useMatchIntent()

  const handleSubmit = useCallback(async () => {
    setValidationError(null)

    // Validation
    if (!inscriptionId.trim()) {
      setValidationError('Inscription ID is required')
      return
    }

    const bpsNum = Number(bps)
    if (!bps || isNaN(bpsNum) || bpsNum < 1 || bpsNum > 10000) {
      setValidationError('BPS must be between 1 and 10000')
      return
    }

    const intent: TakerIntent = {
      action,
      bps: bpsNum,
      inscription_id: inscriptionId.trim(),
    }

    const result = await matchIntent(intent)
    if (result) {
      onMatch(intent, result)
    }
  }, [action, inscriptionId, bps, matchIntent, onMatch])

  if (engineOffline) {
    return <MatchingEngineBanner type="offline" />
  }

  return (
    <div className="space-y-8">
      {/* Action selector */}
      <div className="space-y-3">
        <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
          Action
        </Label>
        <ToggleGroup
          type="single"
          value={action}
          onValueChange={(v) => v && setAction(v as 'Borrow' | 'Lend')}
          variant="outline"
          size="sm"
          className="bg-surface/50 rounded-xl w-full justify-start border border-edge/30"
        >
          <ToggleGroupItem value="Borrow" className="flex-1 text-xs uppercase tracking-widest data-[state=on]:bg-star/20">
            Borrow
          </ToggleGroupItem>
          <ToggleGroupItem value="Lend" className="flex-1 text-xs uppercase tracking-widest data-[state=on]:bg-star/20">
            Lend
          </ToggleGroupItem>
          <ToggleGroupItem value="Swap" disabled className="flex-1 text-xs uppercase tracking-widest relative">
            Swap
            <Badge variant="outline" className="absolute -top-2 -right-1 text-[8px] px-1 py-0 border-ash/40 text-ash">
              Soon
            </Badge>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Inscription ID */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Inscription ID <span className="text-star">*</span>
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            Hex identifier of the inscription to match against
          </p>
        </div>
        <Input
          value={inscriptionId}
          onChange={(e) => setInscriptionId(e.target.value)}
          placeholder="0x..."
          className="bg-surface/50 border-edge/50 focus:border-star font-mono"
        />
      </div>

      {/* BPS amount */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
            Amount (BPS) <span className="text-star">*</span>
          </Label>
          <p className="text-[10px] text-ash/60 uppercase tracking-tight">
            1 to 10000 (10000 = 100%)
          </p>
        </div>
        <Input
          type="number"
          value={bps}
          onChange={(e) => setBps(e.target.value)}
          placeholder="10000"
          min={1}
          max={10000}
          className="bg-surface/50 border-edge/50 focus:border-star"
        />
      </div>

      {/* Validation / API errors */}
      {(validationError || error) && (
        <p className="text-xs text-nova">{validationError || error}</p>
      )}

      {/* Submit */}
      <Button
        variant="gold"
        size="xl"
        className="w-full h-14 text-base uppercase tracking-widest"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Matching...' : 'Find Matches'}
      </Button>
    </div>
  )
}
