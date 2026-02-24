'use client'

import { useState, useMemo } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256, ASSET_TYPE_ENUM, findTokenByAddress } from '@stela/core'
import type { AssetType } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { parseAmount } from '@/lib/amount'
import { AssetInput } from '@/components/AssetInput'
import type { AssetInputValue } from '@/components/AssetInput'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { formatTimestamp } from '@/lib/format'

const emptyAsset = (): AssetInputValue => ({
  asset: '',
  asset_type: 'ERC20',
  value: '',
  token_id: '0',
  decimals: 18,
})

const DURATION_UNITS = [
  { label: 'Minutes', value: '60' },
  { label: 'Hours', value: '3600' },
  { label: 'Days', value: '86400' },
]

const DEADLINE_PRESETS = [
  { label: '1h', value: '3600' },
  { label: '24h', value: '86400' },
  { label: '3d', value: '259200' },
  { label: '7d', value: '604800' },
]

function serializeAssets(assets: AssetInputValue[]): string[] {
  const valid = assets.filter((a) => {
    if (!a.asset) return false
    // NFTs use token_id, fungibles must have a non-zero value
    if (a.asset_type === 'ERC721' || a.asset_type === 'ERC1155') return true
    const raw = a.value ? parseAmount(a.value, a.decimals) : 0n
    return raw > 0n
  })
  const calldata: string[] = [String(valid.length)]
  for (const a of valid) {
    calldata.push(a.asset)
    calldata.push(String(ASSET_TYPE_ENUM[a.asset_type]))
    // Convert human-readable amount to raw value using decimals
    const rawValue = a.value ? parseAmount(a.value, a.decimals) : 0n
    calldata.push(...toU256(rawValue))
    calldata.push(...toU256(BigInt(a.token_id || '0')))
  }
  return calldata
}

function AssetSection({
  title,
  assets,
  setAssets,
  required,
  showErrors,
  balances,
}: {
  title: string
  assets: AssetInputValue[]
  setAssets: (val: AssetInputValue[]) => void
  required?: boolean
  showErrors?: boolean
  balances?: Map<string, bigint>
}) {
  const hasValid = assets.some((a) => a.asset)
  const missing = required && showErrors && !hasValid

  const descriptions: Record<string, string> = {
    'Debt Assets': 'The principal assets the borrower wishes to receive.',
    'Interest Assets': 'The reward assets paid to the lender upon repayment.',
    'Collateral Assets': 'The guarantee assets locked to secure the loan.',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-display uppercase tracking-widest text-chalk">
            {title}
            {required && <span className="text-star ml-1">*</span>}
          </h3>
          <p className="text-[10px] text-ash uppercase tracking-wider">{descriptions[title]}</p>
        </div>
        <button
          type="button"
          onClick={() => setAssets([...assets, emptyAsset()])}
          className="text-xs text-star hover:text-star-bright transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2v8M2 6h8" />
          </svg>
          Add asset
        </button>
      </div>
      <div className="space-y-2">
        {assets.map((a, i) => (
          <AssetInput
            key={i}
            index={i}
            value={a}
            onChange={(val) => {
              const next = [...assets]
              next[i] = val
              setAssets(next)
            }}
            onRemove={() => setAssets(assets.filter((_, j) => j !== i))}
            balances={balances}
          />
        ))}
        {assets.length === 0 && (
          <p className="text-xs text-ash py-3 text-center">No assets added yet</p>
        )}
        {missing && (
          <p className="text-xs text-nova">At least one {title.toLowerCase().replace(' assets', '')} asset with a contract address is required.</p>
        )}
      </div>
    </div>
  )
}

export default function CreatePage() {
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([emptyAsset()])
  
  // Duration handling
  const [durationValue, setDurationValue] = useState('1')
  const [durationUnit, setDurationUnit] = useState('86400') // Default to Days
  const duration = useMemo(() => {
    const val = parseFloat(durationValue) || 0
    return Math.floor(val * Number(durationUnit)).toString()
  }, [durationValue, durationUnit])

  // Deadline handling
  const [deadlinePreset, setDeadlinePreset] = useState('86400') // Default 24h
  const [customDeadline, setCustomDeadline] = useState('')
  const [useCustomDeadline, setUseCustomDeadline] = useState(false)
  
  const deadline = useMemo(() => {
    if (useCustomDeadline) return customDeadline
    const now = Math.floor(Date.now() / 1000)
    return (now + Number(deadlinePreset)).toString()
  }, [deadlinePreset, customDeadline, useCustomDeadline])

  const [showErrors, setShowErrors] = useState(false)
  const { balances } = useTokenBalances()

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isValid = hasDebt && hasCollateral && hasDuration

  // ROI Math
  const roiInfo = useMemo(() => {
    const debt = debtAssets.filter((a) => a.asset && a.asset_type === 'ERC20')
    const interest = interestAssets.filter((a) => a.asset && a.asset_type === 'ERC20')

    if (debt.length === 1 && interest.length === 1) {
      const debtToken = findTokenByAddress(debt[0].asset)
      const intToken = findTokenByAddress(interest[0].asset)

      const dVal = debt[0].value ? parseAmount(debt[0].value, debt[0].decimals) : 0n
      const iVal = interest[0].value ? parseAmount(interest[0].value, interest[0].decimals) : 0n

      if (dVal > 0n) {
        const yieldPct = (Number(iVal) * 100) / Number(dVal)
        return {
          yieldPct: yieldPct.toFixed(2),
          symbol: debtToken?.symbol || '?',
          intSymbol: intToken?.symbol || '?',
          isSameToken: debtToken?.symbol === intToken?.symbol,
        }
      }
    }
    return null
  }, [debtAssets, interestAssets])

  async function handleSubmit() {
    if (!address) return
    setShowErrors(true)
    if (!isValid) return

    // Build ERC20 approval calls for collateral assets the borrower is committing.
    const approvals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
    const assetsToApprove = collateralAssets

    for (const asset of assetsToApprove) {
      if (!asset.asset) continue
      if (asset.asset_type === 'ERC721' || asset.asset_type === 'ERC1155') continue
      const rawValue = asset.value ? parseAmount(asset.value, asset.decimals) : 0n
      if (rawValue <= 0n) continue
      approvals.push({
        contractAddress: asset.asset,
        entrypoint: 'approve',
        calldata: [CONTRACT_ADDRESS, ...toU256(rawValue)],
      })
    }

    const calldata = [
      '1', // is_borrow = true (borrower flow only)
      ...serializeAssets(debtAssets),
      ...serializeAssets(interestAssets),
      ...serializeAssets(collateralAssets),
      String(duration || '0'),
      String(deadline || '0'),
      multiLender ? '1' : '0',
    ]

    try {
      const result = await sendAsync([
        ...approvals,
        {
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: 'create_inscription',
          calldata,
        },
      ])
      toast.success('Inscription created', { description: result.transaction_hash })
    } catch (err: unknown) {
      toast.error('Failed to create inscription', { description: getErrorMessage(err) })
    }
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
            Inscribe the Stela
          </h1>
          <p className="text-dust leading-relaxed">
            Define the terms of your lending inscription on StarkNet.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-full border border-edge/30 w-fit">
          <span className="text-[10px] font-mono text-ash uppercase tracking-widest">Type: New Inscription</span>
        </div>
      </div>

      <div className="space-y-8">
        {/* Asset sections */}
        <div className="space-y-10">
          <AssetSection title="Debt Assets" assets={debtAssets} setAssets={setDebtAssets} required showErrors={showErrors} balances={balances} />
          <AssetSection title="Interest Assets" assets={interestAssets} setAssets={setInterestAssets} balances={balances} />
          <AssetSection title="Collateral Assets" assets={collateralAssets} setAssets={setCollateralAssets} required showErrors={showErrors} balances={balances} />
        </div>

        <Separator />

        {/* Configuration Section */}
        <div className="bg-surface/20 border border-edge/30 rounded-3xl p-6 space-y-8">
          <div className="grid sm:grid-cols-2 gap-8">
            {/* Duration */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
                  Loan Duration <span className="text-star">*</span>
                </Label>
                <p className="text-[10px] text-ash/60 uppercase tracking-tight">Time to repay after signing</p>
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  className="flex-1"
                  placeholder="Value"
                />
                <ToggleGroup 
                  type="single" 
                  value={durationUnit} 
                  onValueChange={(v) => v && setDurationUnit(v)}
                  variant="outline"
                  size="sm"
                  className="bg-abyss/50 rounded-xl"
                >
                  {DURATION_UNITS.map(u => (
                    <ToggleGroupItem key={u.value} value={u.value} className="text-[10px] uppercase px-2">
                      {u.label.charAt(0)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            {/* Deadline */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-ash uppercase tracking-widest font-bold">
                  Discovery Deadline
                </Label>
                <p className="text-[10px] text-ash/60 uppercase tracking-tight">When this offer expires</p>
              </div>

              {useCustomDeadline ? (
                <div className="flex gap-2">
                   <Input
                    type="number"
                    value={customDeadline}
                    onChange={(e) => setCustomDeadline(e.target.value)}
                    className="flex-1"
                    placeholder="Unix timestamp"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setUseCustomDeadline(false)} className="text-[10px] uppercase">Presets</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <ToggleGroup 
                    type="single" 
                    value={deadlinePreset} 
                    onValueChange={(v) => v && setDeadlinePreset(v)}
                    variant="outline"
                    size="sm"
                    className="bg-abyss/50 rounded-xl w-full justify-start"
                  >
                    {DEADLINE_PRESETS.map(p => (
                      <ToggleGroupItem key={p.value} value={p.value} className="text-[10px] uppercase flex-1">
                        {p.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <button 
                    onClick={() => setUseCustomDeadline(true)}
                    className="text-[10px] text-ash hover:text-star text-left uppercase tracking-widest pl-1"
                  >
                    Set custom timestamp
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-edge/20">
             <div className="flex items-start gap-3">
              <Switch checked={multiLender} onCheckedChange={setMultiLender} id="multi-lender" />
              <Label htmlFor="multi-lender" className="cursor-pointer">
                <span className="text-xs text-chalk block">Allow multiple lenders</span>
                <span className="text-[10px] text-ash block uppercase tracking-tight">Lenders can fund partially</span>
              </Label>
            </div>

            <div className="text-right">
               <span className="text-[10px] text-ash uppercase tracking-widest block">Calculated Deadline</span>
               <span className="text-xs text-dust font-mono">{formatTimestamp(BigInt(deadline))}</span>
            </div>
          </div>
        </div>

        {/* ROI Preview Math */}
        {roiInfo && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold whitespace-nowrap">Preview Specifications</span>
              <div className="h-px w-full bg-edge/20" />
            </div>
            
            <Card className="border-star/20 bg-star/[0.02] rounded-[32px] overflow-hidden">
              <CardContent className="p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Projected Yield for Lender</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-display text-star">+{roiInfo.yieldPct}%</span>
                      <span className="text-dust text-sm">in {roiInfo.intSymbol}</span>
                    </div>
                    {!roiInfo.isSameToken && (
                      <p className="text-[10px] text-ash uppercase tracking-tight">
                        Note: Interest paid in {roiInfo.intSymbol} for {roiInfo.symbol} debt.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="bg-star/10 px-4 py-2 rounded-2xl border border-star/20 text-center">
                      <span className="text-[10px] text-star uppercase tracking-widest font-bold block">Status</span>
                      <span className="text-xs text-chalk font-display uppercase">Open Draft</span>
                    </div>
                    <div className="bg-surface/40 px-4 py-2 rounded-2xl border border-edge/20 text-center">
                      <span className="text-[10px] text-ash uppercase tracking-widest font-bold block">Type</span>
                      <span className="text-xs text-dust font-display uppercase">{multiLender ? 'Multi-Lender' : 'Single-Lender'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Submit */}
        <Web3ActionWrapper message="Connect your wallet to create an inscription">
          <Button
            variant="gold"
            size="xl"
            className="w-full h-16 text-lg uppercase tracking-widest"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Creating Inscription...' : 'Create Inscription'}
          </Button>
        </Web3ActionWrapper>
      </div>
    </div>
  )
}
