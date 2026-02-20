'use client'

import { useState } from 'react'
import type { AssetType } from '@stela/core'
import { AssetInput } from '@/components/AssetInput'
import { WalletButton } from '@/components/WalletButton'

interface AssetRow {
  asset: string
  asset_type: AssetType
  value: string
  token_id: string
}

const emptyAsset = (): AssetRow => ({
  asset: '',
  asset_type: 'ERC20',
  value: '',
  token_id: '0',
})

export default function CreatePage() {
  const [isBorrow, setIsBorrow] = useState(true)
  const [multiLender, setMultiLender] = useState(false)
  const [debtAssets, setDebtAssets] = useState<AssetRow[]>([emptyAsset()])
  const [interestAssets, setInterestAssets] = useState<AssetRow[]>([emptyAsset()])
  const [collateralAssets, setCollateralAssets] = useState<AssetRow[]>([emptyAsset()])
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')

  function updateAsset(
    setter: (val: AssetRow[]) => void,
    list: AssetRow[],
    index: number,
    val: AssetRow
  ) {
    const next = [...list]
    next[index] = val
    setter(next)
  }

  function removeAsset(setter: (val: AssetRow[]) => void, list: AssetRow[], index: number) {
    setter(list.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Create Agreement</h1>
        <WalletButton />
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={isBorrow}
              onChange={() => setIsBorrow(true)}
            />
            I want to borrow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!isBorrow}
              onChange={() => setIsBorrow(false)}
            />
            I want to lend
          </label>
        </div>

        <div>
          <h3 className="font-medium mb-2">Debt Assets</h3>
          {debtAssets.map((a, i) => (
            <AssetInput
              key={i}
              index={i}
              value={a}
              onChange={(val) => updateAsset(setDebtAssets, debtAssets, i, val)}
              onRemove={() => removeAsset(setDebtAssets, debtAssets, i)}
            />
          ))}
          <button
            onClick={() => setDebtAssets([...debtAssets, emptyAsset()])}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add debt asset
          </button>
        </div>

        <div>
          <h3 className="font-medium mb-2">Interest Assets</h3>
          {interestAssets.map((a, i) => (
            <AssetInput
              key={i}
              index={i}
              value={a}
              onChange={(val) => updateAsset(setInterestAssets, interestAssets, i, val)}
              onRemove={() => removeAsset(setInterestAssets, interestAssets, i)}
            />
          ))}
          <button
            onClick={() => setInterestAssets([...interestAssets, emptyAsset()])}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add interest asset
          </button>
        </div>

        <div>
          <h3 className="font-medium mb-2">Collateral Assets</h3>
          {collateralAssets.map((a, i) => (
            <AssetInput
              key={i}
              index={i}
              value={a}
              onChange={(val) => updateAsset(setCollateralAssets, collateralAssets, i, val)}
              onRemove={() => removeAsset(setCollateralAssets, collateralAssets, i)}
            />
          ))}
          <button
            onClick={() => setCollateralAssets([...collateralAssets, emptyAsset()])}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Add collateral asset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 86400 for 1 day"
              className="w-full bg-neutral-800 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Deadline (unix timestamp)</label>
            <input
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="e.g. 1700000000"
              className="w-full bg-neutral-800 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={multiLender}
            onChange={(e) => setMultiLender(e.target.checked)}
          />
          Allow multiple lenders
        </label>

        <button className="w-full py-3 bg-blue-600 rounded font-medium hover:bg-blue-500">
          Create Agreement
        </button>
      </div>
    </div>
  )
}
