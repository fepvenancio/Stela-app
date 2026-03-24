'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenAvatar } from '@/components/TokenAvatar'
import { findTokenByAddress } from '@fepvenancio/stela-sdk'
import { Layers, Activity, Clock, CheckCircle } from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────── */

interface InscriptionAsset {
  asset_address: string
  asset_type: string
  asset_role: 'debt' | 'interest' | 'collateral'
}

interface Inscription {
  id: string
  status: string
  signed_at: number | string
  assets: InscriptionAsset[]
}

interface ProtocolStats {
  total: number
  active: number
  open: number
  completed: number
}

interface TokenUsage {
  address: string
  symbol: string
  debtCount: number
  collateralCount: number
  interestCount: number
}

/* ── Helpers ────────────────────────────────────────────────── */

async function fetchAllInscriptions(): Promise<Inscription[]> {
  const all: Inscription[] = []
  let page = 1
  while (true) {
    const res = await fetch(`/api/inscriptions?limit=50&page=${page}`)
    const data = await res.json() as { data?: Inscription[]; meta?: { total?: number }; error?: string }
    if (data.error || !data.data?.length) break
    all.push(...data.data)
    const total = data.meta?.total ?? 0
    if (all.length >= total) break
    page++
  }
  return all
}

function relativeTime(ts: number | string): string {
  const secs = Math.floor(Date.now() / 1000) - Number(ts)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

/* ── Skeleton helpers ───────────────────────────────────────── */

function StatSkeleton() {
  return (
    <div className="bg-surface p-8 rounded-[2rem] border border-border flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

/* ── Status badge ───────────────────────────────────────────── */

type BadgeVariant =
  | 'default' | 'secondary' | 'destructive' | 'outline'
  | 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated'
  | 'expired' | 'overdue' | 'auctioned' | 'grace_period'
  | 'cancelled' | 'pending' | 'matched' | 'settled'
  | 'atrisk' | 'testnet' | 'mainnet'

function StatusBadge({ status }: { status: string }) {
  const variant = status as BadgeVariant
  return (
    <Badge variant={variant} className="capitalize text-[10px]">
      {status}
    </Badge>
  )
}

/* ── Dashboard page ─────────────────────────────────────────── */

export default function DashboardPage() {
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAllInscriptions()
      .then(setInscriptions)
      .finally(() => setIsLoading(false))
  }, [])

  /* ── Protocol stats ─────────────────────────────────────── */
  const stats: ProtocolStats = {
    total: inscriptions.length,
    active: inscriptions.filter((i) => i.status === 'filled').length,
    open: inscriptions.filter((i) => i.status === 'open').length,
    completed: inscriptions.filter(
      (i) => i.status === 'repaid' || i.status === 'expired' || i.status === 'liquidated',
    ).length,
  }

  /* ── Per-token breakdown ────────────────────────────────── */
  const tokenUsageMap = new Map<string, TokenUsage>()

  for (const ins of inscriptions) {
    for (const asset of ins.assets) {
      const addr = asset.asset_address?.toLowerCase()
      if (!addr) continue
      if (!tokenUsageMap.has(addr)) {
        const token = findTokenByAddress(addr)
        tokenUsageMap.set(addr, {
          address: addr,
          symbol: token?.symbol ?? addr.slice(0, 8) + '…',
          debtCount: 0,
          collateralCount: 0,
          interestCount: 0,
        })
      }
      const entry = tokenUsageMap.get(addr)!
      if (asset.asset_role === 'debt') entry.debtCount++
      else if (asset.asset_role === 'collateral') entry.collateralCount++
      else if (asset.asset_role === 'interest') entry.interestCount++
    }
  }

  const tokenUsage = Array.from(tokenUsageMap.values()).sort(
    (a, b) => b.debtCount + b.collateralCount + b.interestCount - (a.debtCount + a.collateralCount + a.interestCount),
  )

  /* ── Recent activity (5 most recent) ───────────────────── */
  const recent = [...inscriptions]
    .sort((a, b) => Number(b.signed_at) - Number(a.signed_at))
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-10 animate-fade-in">

      {/* ── Page title ──────────────────────────────────────── */}
      <div>
        <h1 className="text-5xl font-bold tracking-tighter text-white">Protocol</h1>
        <p className="text-micro mt-2">Real-time Stela protocol metrics</p>
      </div>

      {/* ── Row 1: Stat cards ───────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Stelas"
            value={String(stats.total)}
            subValue="All inscriptions"
            icon={Layers}
            color="accent"
          />
          <StatCard
            title="Active"
            value={String(stats.active)}
            subValue="Loans in progress"
            icon={Activity}
            color="green"
          />
          <StatCard
            title="Open Orders"
            value={String(stats.open)}
            subValue="Waiting to be filled"
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={String(stats.completed)}
            subValue="Repaid / expired / liquidated"
            icon={CheckCircle}
            color="purple"
          />
        </div>
      )}

      {/* ── Row 2: Per-token breakdown table ────────────────── */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Token Usage</h2>
          <p className="text-micro mt-1">How each token is used across all inscriptions</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl" />
            ))}
          </div>
        ) : tokenUsage.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No inscription data yet</p>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="grid grid-cols-4 gap-6 px-4 pb-3">
              <span className="text-micro">Token</span>
              <span className="text-micro text-center">Debt uses</span>
              <span className="text-micro text-center">Collateral uses</span>
              <span className="text-micro text-center">Interest uses</span>
            </div>
            {/* Rows */}
            {tokenUsage.map((t) => {
              const token = findTokenByAddress(t.address)
              return (
                <div
                  key={t.address}
                  className="grid grid-cols-4 gap-6 px-4 py-4 items-center border-t border-border/50 first:border-0"
                >
                  <div className="flex items-center gap-3">
                    {token ? (
                      <TokenAvatar token={token} size={28} />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-border flex items-center justify-center text-[10px] font-bold text-gray-500">
                        ?
                      </div>
                    )}
                    <span className="text-sm font-bold text-white">{t.symbol}</span>
                  </div>
                  <span className="text-sm font-mono text-gray-300 text-center">{t.debtCount}</span>
                  <span className="text-sm font-mono text-gray-300 text-center">{t.collateralCount}</span>
                  <span className="text-sm font-mono text-gray-300 text-center">{t.interestCount}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Row 3: Recent activity ───────────────────────────── */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-8 flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Recent Activity</h2>
          <p className="text-micro mt-1">5 most recent inscriptions</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No inscriptions yet</p>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="grid grid-cols-4 gap-6 px-6 pb-3">
              <span className="text-micro">ID</span>
              <span className="text-micro">Status</span>
              <span className="text-micro">Created</span>
              <span className="text-micro">Assets</span>
            </div>
            {/* Rows */}
            {recent.map((ins) => {
              const assetSymbols = [
                ...new Set(
                  ins.assets
                    .map((a) => {
                      const t = findTokenByAddress(a.asset_address?.toLowerCase())
                      return t?.symbol ?? a.asset_address?.slice(0, 6) ?? '?'
                    })
                ),
              ].join(', ')

              return (
                <Link
                  key={ins.id}
                  href={`/stelas/${ins.id}`}
                  className="grid grid-cols-4 gap-6 px-6 py-4 items-center border-t border-border/50 first:border-0 hover:bg-white/[0.02] transition-all rounded-2xl"
                >
                  <span className="text-sm font-mono text-gray-400 truncate">
                    {ins.id.slice(0, 10)}…
                  </span>
                  <StatusBadge status={ins.status} />
                  <span className="text-sm text-gray-500">
                    {ins.signed_at ? relativeTime(ins.signed_at) : '—'}
                  </span>
                  <span className="text-sm text-gray-400 truncate">{assetSymbols || '—'}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
