'use client'

import { InfoTooltip } from '@/components/InfoTooltip'
import { CONCEPT_DESCRIPTIONS } from '@/lib/status'

export function ListingTableHeader() {
  return (
    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[9px] text-dust uppercase tracking-widest font-semibold border-b border-edge/40 sticky top-16 bg-void/95 backdrop-blur-sm z-10 mb-px">
      <div className="grid grid-cols-12 gap-3 flex-1">
        <div className="col-span-2">Status</div>
        <div className="col-span-3 flex items-center gap-1">
          Debt
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.debt} side="bottom" />
        </div>
        <div className="col-span-2 flex items-center gap-1">
          Interest
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.interest} side="bottom" />
        </div>
        <div className="col-span-2 flex items-center gap-1">
          Collateral
          <InfoTooltip content={CONCEPT_DESCRIPTIONS.collateral} side="bottom" />
        </div>
        <div className="col-span-1 text-right">Yield</div>
        <div className="col-span-2 text-right">Action</div>
      </div>
    </div>
  )
}
