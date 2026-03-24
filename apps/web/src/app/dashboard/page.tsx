'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useAccount } from '@starknet-react/core'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { StatCard } from '@/components/StatCard'
import { MarketRow } from '@/components/MarketRow'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { normalizeAddress } from '@/lib/address'
import { findTokenByAddress, getTokensForNetwork } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import {
  Wallet,
  HandCoins,
  FileSignature,
  ShieldCheck,
  ArrowRight,
  Layers,
  TrendingUp,
} from 'lucide-react'

/* ── Helpers ──────────────────────────────────────────────── */

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

/* ── Stat skeletons ───────────────────────────────────────── */

function StatSkeleton() {
  return (
    <div className="bg-surface p-8 rounded-[2rem] border border-border flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  )
}

/* ── Active position row ──────────────────────────────────── */

interface PositionRowProps {
  id: string
  role: 'Lending' | 'Borrowing'
  status: string
  assets: string
}

function PositionRow({ id, role, status, assets }: PositionRowProps) {
  const roleColor = role === 'Lending' ? 'text-green-500' : 'text-orange-500'
  const statusColor =
    status === 'filled'
      ? 'text-green-400'
      : status === 'partial'
        ? 'text-blue-400'
        : 'text-gray-500'

  return (
    <Link
      href={`/stelas/${id}`}
      className="grid grid-cols-4 gap-6 p-6 items-center hover:bg-white/[0.02] transition-all rounded-2xl border border-transparent hover:border-border group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.02] border border-border flex items-center justify-center group-hover:border-accent/20 transition-colors">
          <Layers size={14} className="text-gray-500" />
        </div>
        <span className="text-sm font-mono text-gray-400 truncate">{id.slice(0, 10)}…</span>
      </div>
      <span className={`text-sm font-bold ${roleColor}`}>{role}</span>
      <span className={`text-sm font-bold capitalize ${statusColor}`}>{status}</span>
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-gray-400 truncate">{assets}</span>
        <ArrowRight size={14} className="text-gray-600 group-hover:text-accent transition-colors flex-shrink-0" />
      </div>
    </Link>
  )
}

/* ── Dashboard page ───────────────────────────────────────── */

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const normalizedAddress = address ? normalizeAddress(address) : undefined
  const portfolio = usePortfolio(normalizedAddress)
  const { balances } = useTokenBalances()

  /* ── Derived stats ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const lendingCount = portfolio.lending.length + portfolio.lendingOrders.length
    const borrowingCount = portfolio.borrowing.length + portfolio.borrowingOrders.length
    const healthFactor =
      borrowingCount === 0
        ? '∞'
        : lendingCount > 0
          ? (lendingCount / borrowingCount).toFixed(2)
          : '—'

    return {
      lendingCount,
      borrowingCount,
      healthFactor,
      isLoading: portfolio.isLoading,
    }
  }, [portfolio])

  /* ── Token balances summary ────────────────────────────── */
  const tokenList = useMemo(() => {
    const networkTokens = getTokensForNetwork(NETWORK)
    const result: { symbol: string; balance: bigint; decimals: number }[] = []
    for (const token of networkTokens) {
      const addr = token.addresses[NETWORK]
      if (!addr) continue
      const balance = balances.get(addr.toLowerCase()) ?? 0n
      if (balance > 0n) {
        result.push({ symbol: token.symbol, balance, decimals: token.decimals ?? 18 })
      }
    }
    return result.slice(0, 5)
  }, [balances])

  /* ── Active positions (combined lending + borrowing) ───── */
  const activePositions = useMemo(() => {
    const positions: PositionRowProps[] = []

    for (const ins of portfolio.lending.slice(0, 3)) {
      const assetTokens = (ins.assets ?? [])
        .map((a) => findTokenByAddress(a.asset_address)?.symbol ?? a.asset_address.slice(0, 6))
        .join(', ')
      positions.push({ id: ins.id, role: 'Lending', status: ins.computedStatus, assets: assetTokens || '—' })
    }

    for (const ins of portfolio.borrowing.slice(0, 3)) {
      const assetTokens = (ins.assets ?? [])
        .map((a) => findTokenByAddress(a.asset_address)?.symbol ?? a.asset_address.slice(0, 6))
        .join(', ')
      positions.push({ id: ins.id, role: 'Borrowing', status: ins.computedStatus, assets: assetTokens || '—' })
    }

    return positions.slice(0, 5)
  }, [portfolio])

  /* ── Placeholder market data ──────────────────────────── */
  const markets = [
    { symbol: 'STRK', totalLent: '—', lendApy: '—', borrowApy: '—', utilization: 0 },
    { symbol: 'ETH',  totalLent: '—', lendApy: '—', borrowApy: '—', utilization: 0 },
    { symbol: 'USDC', totalLent: '—', lendApy: '—', borrowApy: '—', utilization: 0 },
  ]

  return (
    <div className="flex flex-col gap-10 animate-fade-in">

      {/* ── Page title ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-micro mt-1">Your lending &amp; borrowing overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/trade">
            <Button variant="outline" size="sm" className="gap-2">
              <HandCoins size={14} />
              Lend
            </Button>
          </Link>
          <Link href="/borrow">
            <Button size="sm" className="gap-2">
              <FileSignature size={14} />
              Borrow
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      {!isConnected ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Net Worth" value="—" subValue="Connect wallet" icon={Wallet} color="accent" />
          <StatCard title="Total Lent" value="—" subValue="Connect wallet" icon={HandCoins} color="green" />
          <StatCard title="Total Borrowed" value="—" subValue="Connect wallet" icon={FileSignature} color="orange" />
          <StatCard title="Health Factor" value="—" subValue="Connect wallet" icon={ShieldCheck} color="purple" />
        </div>
      ) : stats.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Net Worth"
            value="—"
            subValue="On-chain valuation"
            icon={Wallet}
            color="accent"
          />
          <StatCard
            title="Total Lent"
            value={stats.lendingCount > 0 ? `${stats.lendingCount} positions` : '—'}
            subValue={stats.lendingCount > 0 ? 'Active positions' : 'No active loans'}
            icon={HandCoins}
            color="green"
          />
          <StatCard
            title="Total Borrowed"
            value={stats.borrowingCount > 0 ? `${stats.borrowingCount} positions` : '—'}
            subValue={stats.borrowingCount > 0 ? 'Active positions' : 'No active loans'}
            icon={FileSignature}
            color="orange"
          />
          <StatCard
            title="Health Factor"
            value={stats.healthFactor}
            subValue={stats.borrowingCount === 0 ? 'No debt' : 'Lend / Borrow ratio'}
            icon={ShieldCheck}
            color="purple"
          />
        </div>
      )}

      {/* ── Main content grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Active positions ─────────────────────────────── */}
        <div className="xl:col-span-2 bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Active Positions</h2>
              <p className="text-micro mt-1">Your open lending &amp; borrowing</p>
            </div>
            {activePositions.length > 0 && (
              <Link href="/portfolio">
                <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-white">
                  View all <ArrowRight size={12} />
                </Button>
              </Link>
            )}
          </div>

          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-border flex items-center justify-center">
                <Wallet size={20} className="text-gray-600" />
              </div>
              <p className="text-sm text-gray-500">Connect your wallet to view positions</p>
            </div>
          ) : stats.isLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : activePositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-border flex items-center justify-center">
                <TrendingUp size={20} className="text-gray-600" />
              </div>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                No active positions yet. Start by lending or borrowing.
              </p>
              <div className="flex items-center gap-3">
                <Link href="/trade">
                  <Button variant="outline" size="sm">Lend Assets</Button>
                </Link>
                <Link href="/borrow">
                  <Button size="sm">Borrow Assets</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Table header */}
              <div className="grid grid-cols-4 gap-6 px-6 pb-3">
                <span className="text-micro">Position</span>
                <span className="text-micro">Role</span>
                <span className="text-micro">Status</span>
                <span className="text-micro text-right">Assets</span>
              </div>
              {activePositions.map((pos) => (
                <PositionRow key={pos.id} {...pos} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Your Assets */}
          <div className="bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-5">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Your Assets</h2>
              <p className="text-micro mt-1">Wallet token balances</p>
            </div>

            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Wallet size={18} className="text-gray-600" />
                <p className="text-xs text-gray-600 text-center">Connect wallet to view</p>
              </div>
            ) : tokenList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <p className="text-xs text-gray-600 text-center">No token balances found</p>
                {NETWORK === 'sepolia' && (
                  <Link href="/faucet">
                    <Button variant="outline" size="sm" className="text-xs">Get Testnet Tokens</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tokenList.map(({ symbol, balance, decimals }) => {
                  const divisor = 10n ** BigInt(decimals)
                  const whole = balance / divisor
                  const frac = balance % divisor
                  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4)
                  const displayBalance = `${whole.toString()}.${fracStr}`

                  return (
                    <div key={symbol} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.02] border border-border flex items-center justify-center text-[10px] font-bold text-gray-500">
                          {symbol[0]}
                        </div>
                        <span className="text-sm font-bold text-white">{symbol}</span>
                      </div>
                      <span className="text-sm font-mono text-gray-300">{displayBalance}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stela Inscriptions CTA */}
          <div className="bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-white/5">
                  <Layers size={18} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Stela Inscriptions</h2>
                  <p className="text-micro mt-0.5">P2P Lending Protocol</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                Create inscriptions to borrow against your assets. Set custom terms and get matched with lenders on StarkNet.
              </p>
              <Link href="/stelas" className="block">
                <Button className="w-full gap-2">
                  Browse Inscriptions <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* ── Markets overview ───────────────────────────────── */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Markets</h2>
            <p className="text-micro mt-1">Protocol utilization overview</p>
          </div>
          <Link href="/markets">
            <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-white">
              View all <ArrowRight size={12} />
            </Button>
          </Link>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-5 gap-8 px-8">
          <span className="text-micro">Asset</span>
          <span className="text-micro">Total Lent</span>
          <span className="text-micro">Lend APY</span>
          <span className="text-micro">Borrow APY</span>
          <span className="text-micro text-right">Utilization</span>
        </div>

        <div className="flex flex-col">
          {markets.map((market) => (
            <MarketRow key={market.symbol} {...market} />
          ))}
        </div>
      </div>

    </div>
  )
}
