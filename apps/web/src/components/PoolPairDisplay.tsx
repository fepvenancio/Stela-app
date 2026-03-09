'use client'

import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { TokenAvatar, stringToColor } from '@/components/TokenAvatar'
import { formatAddress } from '@/lib/address'
import { formatTokenValue } from '@/lib/format'

interface AssetItem {
  asset_address: string
  asset_type: string
  value: string | null
  token_id?: string | null
}

interface PoolPairDisplayProps {
  debtAssets: AssetItem[]
  collateralAssets: AssetItem[]
  interestAssets: AssetItem[]
  id: string
  isOffchain?: boolean
}

/** Uniswap-style overlapping token pair with pool name */
export function PoolPairDisplay({ debtAssets, collateralAssets, interestAssets, id, isOffchain }: PoolPairDisplayProps) {
  const debt0 = debtAssets[0]
  const coll0 = collateralAssets[0]

  const debtToken = debt0 ? findTokenByAddress(debt0.asset_address) : null
  const collToken = coll0 ? findTokenByAddress(coll0.asset_address) : null

  const debtSymbol = debtToken?.symbol ?? (debt0 ? formatAddress(debt0.asset_address) : '?')
  const collSymbol = collToken?.symbol ?? (coll0 ? formatAddress(coll0.asset_address) : '?')

  // Format primary debt amount for subtitle
  const debtAmount = debt0 && debtToken
    ? formatTokenValue(debt0.value, debtToken.decimals)
    : debt0?.value ?? ''

  // Interest summary
  const int0 = interestAssets[0]
  const intToken = int0 ? findTokenByAddress(int0.asset_address) : null
  const intAmount = int0 && intToken
    ? `${formatTokenValue(int0.value, intToken.decimals)} ${intToken.symbol}`
    : ''

  const extraDebt = debtAssets.length > 1 ? ` +${debtAssets.length - 1}` : ''

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* Overlapping token pair logos */}
      <div className="relative shrink-0 w-[34px] h-[20px] md:w-[40px] md:h-[24px]">
        {debtToken ? (
          <div className="absolute left-0 top-0 z-[1]">
            <TokenAvatar token={debtToken} size={20} />
          </div>
        ) : (
          <div
            className="absolute left-0 top-0 z-[1] rounded-full flex items-center justify-center text-white font-semibold"
            style={{ width: 20, height: 20, backgroundColor: stringToColor(debtSymbol), fontSize: 8 }}
          >
            {debtSymbol.charAt(0)}
          </div>
        )}
        {collToken ? (
          <div className="absolute left-[14px] md:left-[16px] top-0 ring-2 ring-void rounded-full">
            <TokenAvatar token={collToken} size={20} />
          </div>
        ) : coll0 ? (
          <div
            className="absolute left-[14px] md:left-[16px] top-0 ring-2 ring-void rounded-full flex items-center justify-center text-white font-semibold"
            style={{ width: 20, height: 20, backgroundColor: stringToColor(collSymbol), fontSize: 8 }}
          >
            {collSymbol.charAt(0)}
          </div>
        ) : null}
      </div>

      {/* Pool name + details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs md:text-sm font-medium text-chalk truncate">
            {debtSymbol}{extraDebt} / {collSymbol}
          </span>
          {isOffchain && (
            <span className="text-[7px] text-ash/50 uppercase tracking-wider shrink-0 border border-ash/20 px-1 rounded">oc</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] text-dust truncate">
          {debtAmount && (
            <span>{debtAmount} {debtSymbol}</span>
          )}
          {intAmount && (
            <>
              <span className="text-edge/50">→</span>
              <span className="text-aurora/80">{intAmount}</span>
            </>
          )}
          <span className="font-mono text-[9px] text-ash/40">#{isOffchain ? id.slice(0, 6) : id.slice(2, 8)}</span>
        </div>
      </div>
    </div>
  )
}
