'use client'

import { InfoTooltip } from '@/components/InfoTooltip'
import { CONCEPT_DESCRIPTIONS } from '@/lib/status'

export function ListingTableHeader() {
  return (
    <div className="hidden md:flex items-center gap-4 px-3 pb-2 text-[9px] text-dust uppercase tracking-widest font-semibold">
      <div className="shrink-0 w-5" />
      <div className="grid grid-cols-12 gap-4 flex-1">
        <div className="col-span-2">Status</div>
        <div className="col-span-3 flex items-center gap-1">
          Debt
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.debt} side="bottom" />
        </div>
        <div className="col-span-2 flex items-center gap-1">
          Interest
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.interest} side="bottom" />
        </div>
        <div className="col-span-3 flex items-center gap-1">
          Collateral
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.collateral} side="bottom" />
        </div>
        <div className="col-span-2 text-right flex items-center justify-end gap-1">
          Duration
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.duration} side="bottom" />
        </div>
      </div>
    </div>
  )
}
