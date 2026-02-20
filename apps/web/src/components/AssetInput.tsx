'use client'

import type { AssetType } from '@stela/core'

interface AssetInputProps {
  index: number
  value: { asset: string; asset_type: AssetType; value: string; token_id: string }
  onChange: (val: AssetInputProps['value']) => void
  onRemove: () => void
}

const ASSET_TYPES: AssetType[] = ['ERC20', 'ERC721', 'ERC1155', 'ERC4626']

export function AssetInput({ index, value, onChange, onRemove }: AssetInputProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-neutral-500 text-sm w-6">{index + 1}.</span>
      <select
        value={value.asset_type}
        onChange={(e) => onChange({ ...value, asset_type: e.target.value as AssetType })}
        className="bg-neutral-800 rounded px-2 py-1.5 text-sm"
      >
        {ASSET_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Contract address"
        value={value.asset}
        onChange={(e) => onChange({ ...value, asset: e.target.value })}
        className="flex-1 bg-neutral-800 rounded px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        placeholder="Amount"
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        className="w-32 bg-neutral-800 rounded px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        placeholder="Token ID"
        value={value.token_id}
        onChange={(e) => onChange({ ...value, token_id: e.target.value })}
        className="w-24 bg-neutral-800 rounded px-2 py-1.5 text-sm"
      />
      <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-sm">
        Remove
      </button>
    </div>
  )
}
