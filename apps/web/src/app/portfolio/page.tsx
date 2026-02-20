'use client'

import { useAccount } from '@starknet-react/core'
import { useAgreements } from '@/hooks/useAgreements'
import { AgreementCard } from '@/components/AgreementCard'
import { WalletButton } from '@/components/WalletButton'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { data, isLoading, error } = useAgreements(
    address ? { address } : undefined
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <WalletButton />
      </div>

      {!address && (
        <p className="text-neutral-500 text-center py-12">
          Connect your wallet to view your positions
        </p>
      )}

      {address && isLoading && (
        <p className="text-neutral-400">Loading your positions...</p>
      )}

      {error && <p className="text-red-400">Failed to load positions</p>}

      {address && !isLoading && data.length === 0 && (
        <p className="text-neutral-500 text-center py-12">No positions found</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a) => (
          <AgreementCard
            key={a.id}
            id={a.id}
            status={a.status}
            creator={a.creator}
            multiLender={a.multi_lender}
            duration={a.duration}
            debtAssetCount={a.debt_asset_count}
            collateralAssetCount={a.collateral_asset_count}
          />
        ))}
      </div>
    </div>
  )
}
