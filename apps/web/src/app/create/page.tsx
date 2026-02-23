'use client'

import { useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256, ASSET_TYPE_ENUM } from '@stela/core'
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

  const [isBorrow, setIsBorrow] = useState(true)
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const { balances } = useTokenBalances()

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isValid = hasDebt && hasCollateral && hasDuration

  async function handleSubmit() {
    if (!address) return
    setShowErrors(true)
    if (!isValid) return

    // Build ERC20 approval calls for assets the creator is committing.
    // Borrower (is_borrow=true) commits collateral; Lender (is_borrow=false) commits debt.
    const approvals: { contractAddress: string; entrypoint: string; calldata: string[] }[] = []
    const assetsToApprove = isBorrow ? collateralAssets : debtAssets

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
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-widest text-chalk mb-3 uppercase">
          Inscribe the Stela
        </h1>
        <p className="text-dust leading-relaxed">
          Define the terms of your lending inscription on StarkNet.
        </p>
      </div>

      <div className="space-y-8">
        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { val: true, label: 'Borrower', desc: 'Inscribe a debt to receive liquidity' },
            { val: false, label: 'Lender', desc: 'Prepare a stela for signing' },
          ] as const).map(({ val, label, desc }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setIsBorrow(val)}
              className={`p-5 rounded-2xl border text-left transition-all duration-300 stela-focus ${
                isBorrow === val
                  ? 'border-star/50 bg-abyss shadow-[0_0_25px_rgba(232,168,37,0.15),inset_0_0_15px_rgba(0,0,0,0.6)]'
                  : 'border-edge bg-surface/30 hover:border-edge-bright opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`text-sm font-display uppercase tracking-widest ${isBorrow === val ? 'text-star' : 'text-dust'}`}>
                {label}
              </div>
              <div className="text-xs text-ash mt-2 leading-relaxed">{desc}</div>
            </button>
          ))}
        </div>

        <Separator />

        {/* Asset sections */}
        <AssetSection title="Debt Assets" assets={debtAssets} setAssets={setDebtAssets} required showErrors={showErrors} balances={balances} />
        <AssetSection title="Interest Assets" assets={interestAssets} setAssets={setInterestAssets} balances={balances} />
        <AssetSection title="Collateral Assets" assets={collateralAssets} setAssets={setCollateralAssets} required showErrors={showErrors} balances={balances} />

        <Separator />

        {/* Duration & deadline */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label htmlFor="duration" className="text-[10px] text-ash uppercase tracking-widest font-bold">
                Duration (seconds) <span className="text-star">*</span>
              </Label>
              <p className="text-[10px] text-ash/60 uppercase tracking-tight">The repayment window once signed.</p>
            </div>
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
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label htmlFor="deadline" className="text-[10px] text-ash uppercase tracking-widest font-bold">Deadline (unix timestamp)</Label>
              <p className="text-[10px] text-ash/60 uppercase tracking-tight">When the discovery period expires.</p>
            </div>
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
