'use client'

import { useState } from 'react'
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

function AssetSection({
  title,
  assets,
  setAssets,
}: {
  title: string
  assets: AssetInputValue[]
  setAssets: (val: AssetInputValue[]) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-chalk">{title}</h3>
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
      </div>
    </div>
  )
}

export default function CreatePage() {
  const [isBorrow, setIsBorrow] = useState(true)
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetInputValue[]>([emptyAsset()])
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-wide text-chalk mb-3">
          Create Agreement
        </h1>
        <p className="text-dust leading-relaxed">
          Define the terms of your lending agreement on StarkNet.
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
        <AssetSection title="Debt Assets" assets={debtAssets} setAssets={setDebtAssets} />
        <AssetSection title="Interest Assets" assets={interestAssets} setAssets={setInterestAssets} />
        <AssetSection title="Collateral Assets" assets={collateralAssets} setAssets={setCollateralAssets} />

        <div className="h-px bg-edge" />

        {/* Duration & deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dust mb-2">Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 86400 for 1 day"
              className={inputBase}
            />
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
        <button
          type="button"
          className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-b from-star to-star-dim text-void hover:from-star-bright hover:to-star transition-all duration-200 shadow-[0_0_30px_-5px_rgba(232,168,37,0.3)] hover:shadow-[0_0_40px_-5px_rgba(232,168,37,0.45)]"
        >
          Create Agreement
        </button>
      </div>
    </div>
  )
}
