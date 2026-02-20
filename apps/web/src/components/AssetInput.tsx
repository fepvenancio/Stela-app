'use client'

import type { AssetType } from '@stela/core'

interface AssetInputProps {
  index: number
  value: { asset: string; asset_type: AssetType; value: string; token_id: string }
  onChange: (val: AssetInputProps['value']) => void
  onRemove: () => void
}

const ASSET_TYPES: AssetType[] = ['ERC20', 'ERC721', 'ERC1155', 'ERC4626']

const inputBase =
  'bg-surface border border-edge rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-ash focus:border-star focus:outline-none transition-colors'

export function AssetInput({ index, value, onChange, onRemove }: AssetInputProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-abyss/50 border border-edge">
      <span className="mt-2.5 text-[11px] text-ash font-mono w-4 text-right shrink-0">
        {index + 1}
      </span>

      <div className="flex-1 grid grid-cols-[110px_1fr] gap-2">
        <select
          value={value.asset_type}
          onChange={(e) => onChange({ ...value, asset_type: e.target.value as AssetType })}
          className={inputBase}
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Contract address (0x...)"
          value={value.asset}
          onChange={(e) => onChange({ ...value, asset: e.target.value })}
          className={`${inputBase} font-mono`}
        />

        <input
          type="text"
          placeholder="Amount"
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          className={inputBase}
        />

        <input
          type="text"
          placeholder="Token ID"
          value={value.token_id}
          onChange={(e) => onChange({ ...value, token_id: e.target.value })}
          className={inputBase}
        />
      </div>

      <button
        onClick={onRemove}
        className="mt-2 p-1.5 rounded-lg text-ash hover:text-nova hover:bg-nova/10 transition-colors shrink-0"
        aria-label="Remove asset"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}
