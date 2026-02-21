'use client'

import { useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256, ASSET_TYPE_ENUM } from '@stela/core'
import type { AssetType } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { parseAmount } from '@/lib/amount'
import { AssetInput } from '@/components/AssetInput'
import type { AssetInputValue } from '@/components/AssetInput'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'

const emptyAsset = (): AssetInputValue => ({
  asset: '',
  asset_type: 'ERC20',
  value: '',
  token_id: '0',
  decimals: 18,
})

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
}: {
  title: string
  assets: AssetInputValue[]
  setAssets: (val: AssetInputValue[]) => void
  required?: boolean
  showErrors?: boolean
}) {
  const hasValid = assets.some((a) => a.asset)
  const missing = required && showErrors && !hasValid

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-chalk">
          {title}
          {required && <span className="text-star ml-1">*</span>}
        </h3>
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

  const [isBorrow, setIsBorrow] = useState(true)
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isValid = hasDebt && hasCollateral && hasDuration

  async function handleSubmit() {
    if (!address) return
    setShowErrors(true)
    if (!isValid) return

    const calldata = [
      isBorrow ? '1' : '0',
      ...serializeAssets(debtAssets),
      ...serializeAssets(interestAssets),
      ...serializeAssets(collateralAssets),
      String(duration || '0'),
      String(deadline || '0'),
      multiLender ? '1' : '0',
    ]

    try {
      const result = await sendAsync([
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
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-wide text-chalk mb-3">
          Create Inscription
        </h1>
        <p className="text-dust leading-relaxed">
          Define the terms of your lending inscription on StarkNet.
        </p>
      </div>

      <div className="space-y-8">
        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { val: true, label: 'I want to borrow', desc: 'Request a loan with collateral' },
            { val: false, label: 'I want to lend', desc: 'Offer a loan to earn interest' },
          ] as const).map(({ val, label, desc }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setIsBorrow(val)}
              className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                isBorrow === val
                  ? 'border-star/40 bg-star/[0.06]'
                  : 'border-edge bg-surface/30 hover:border-edge-bright'
              }`}
            >
              <div className={`text-sm font-medium ${isBorrow === val ? 'text-star' : 'text-chalk'}`}>
                {label}
              </div>
              <div className="text-xs text-dust mt-1">{desc}</div>
            </button>
          ))}
        </div>

        <Separator />

        {/* Asset sections */}
        <AssetSection title="Debt Assets" assets={debtAssets} setAssets={setDebtAssets} required showErrors={showErrors} />
        <AssetSection title="Interest Assets" assets={interestAssets} setAssets={setInterestAssets} />
        <AssetSection title="Collateral Assets" assets={collateralAssets} setAssets={setCollateralAssets} required showErrors={showErrors} />

        <Separator />

        {/* Duration & deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-dust">
              Duration (seconds) <span className="text-star">*</span>
            </Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 86400 for 1 day"
              aria-invalid={showErrors && !hasDuration ? true : undefined}
              className={showErrors && !hasDuration ? 'border-nova/50' : ''}
            />
            {showErrors && !hasDuration && (
              <p className="text-xs text-nova">Duration is required.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline" className="text-dust">Deadline (unix timestamp)</Label>
            <Input
              id="deadline"
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="e.g. 1700000000"
            />
          </div>
        </div>

        {/* Multi-lender toggle */}
        <div className="flex items-start gap-3">
          <Switch checked={multiLender} onCheckedChange={setMultiLender} id="multi-lender" />
          <Label htmlFor="multi-lender" className="cursor-pointer">
            <span className="text-sm text-chalk block">Allow multiple lenders</span>
            <span className="text-xs text-ash block mt-0.5">Lenders can each fund a portion of the total debt</span>
          </Label>
        </div>

        <Separator />

        {/* Submit */}
        <Web3ActionWrapper message="Connect your wallet to create an inscription">
          <Button
            variant="gold"
            size="xl"
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create Inscription'}
          </Button>
        </Web3ActionWrapper>
      </div>
    </div>
  )
}
