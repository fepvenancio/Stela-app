'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import type { AssetType } from '@stela/core'
import { CONTRACT_ADDRESS } from '@/lib/config'
import { AssetInput } from '@/components/AssetInput'
import type { AssetInputValue } from '@/components/AssetInput'

const emptyAsset = (): AssetInputValue => ({
  asset: '',
  asset_type: 'ERC20',
  value: '',
  token_id: '0',
  decimals: 18,
})

const inputBase =
  'w-full bg-abyss border border-edge rounded-xl px-4 py-2.5 text-sm text-chalk placeholder:text-dust focus:border-star focus:outline-none focus:ring-1 focus:ring-star/30 transition-all'

const ASSET_TYPE_ENUM: Record<AssetType, number> = {
  ERC20: 0,
  ERC721: 1,
  ERC1155: 2,
  ERC4626: 3,
}

function serializeAssets(assets: AssetInputValue[]): string[] {
  const valid = assets.filter((a) => a.asset)
  const calldata: string[] = [String(valid.length)]
  for (const a of valid) {
    calldata.push(a.asset)
    calldata.push(String(ASSET_TYPE_ENUM[a.asset_type]))
    // Convert human-readable amount to raw value using decimals
    const rawValue = a.value
      ? BigInt(Math.floor(parseFloat(a.value) * 10 ** a.decimals))
      : 0n
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
  const router = useRouter()
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})

  const [isBorrow, setIsBorrow] = useState(true)
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const hasDebt = debtAssets.some((a) => a.asset)
  const hasCollateral = collateralAssets.some((a) => a.asset)
  const hasDuration = Boolean(duration && Number(duration) > 0)
  const isValid = hasDebt && hasCollateral && hasDuration

  async function handleSubmit() {
    if (!address) return
    setShowErrors(true)
    if (!isValid) return
    setTxError(null)
    setTxHash(null)

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
      setTxHash(result.transaction_hash)
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : String(err))
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

        <div className="h-px bg-edge" />

        {/* Asset sections */}
        <AssetSection title="Debt Assets" assets={debtAssets} setAssets={setDebtAssets} required showErrors={showErrors} />
        <AssetSection title="Interest Assets" assets={interestAssets} setAssets={setInterestAssets} />
        <AssetSection title="Collateral Assets" assets={collateralAssets} setAssets={setCollateralAssets} required showErrors={showErrors} />

        <div className="h-px bg-edge" />

        {/* Duration & deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dust mb-2">
              Duration (seconds) <span className="text-star">*</span>
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 86400 for 1 day"
              className={`${inputBase} ${showErrors && !hasDuration ? 'border-nova/50' : ''}`}
            />
            {showErrors && !hasDuration && (
              <p className="text-xs text-nova mt-1.5">Duration is required.</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-dust mb-2">Deadline (unix timestamp)</label>
            <input
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="e.g. 1700000000"
              className={inputBase}
            />
          </div>
        </div>

        {/* Multi-lender toggle */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
              multiLender
                ? 'bg-star border-star'
                : 'border-edge group-hover:border-edge-bright'
            }`}
          >
            {multiLender && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-void">
                <path d="M2.5 6l2.5 2.5 4.5-5" />
              </svg>
            )}
          </div>
          <input
            type="checkbox"
            checked={multiLender}
            onChange={(e) => setMultiLender(e.target.checked)}
            className="sr-only"
          />
          <div>
            <span className="text-sm text-chalk block">Allow multiple lenders</span>
            <span className="text-xs text-ash block mt-0.5">
              Lenders can each fund a portion of the total debt
            </span>
          </div>
        </label>

        <div className="h-px bg-edge" />

        {/* Submit */}
        {!address ? (
          <p className="text-sm text-ash text-center py-3">Connect your wallet to create an inscription.</p>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_30px_-5px_rgba(232,168,37,0.3)] hover:shadow-[0_0_40px_-5px_rgba(232,168,37,0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Creating...' : 'Create Inscription'}
          </button>
        )}

        {/* Feedback */}
        {txHash && (
          <p className="text-xs text-aurora font-mono break-all">
            Tx submitted: {txHash}
          </p>
        )}
        {txError && (
          <p className="text-xs text-nova break-all">
            {txError}
          </p>
        )}
      </div>
    </div>
  )
}
