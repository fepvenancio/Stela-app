import { NextRequest } from 'next/server'
import { getD1, jsonResponse, errorResponse, handleOptions, rateLimit, logError } from '@/lib/api'
import { findTokenByAddress } from '@stela/core'
import type {
  OrderBookResponse,
  LendingLevel,
  SwapLevel,
  DurationFilter,
  TokenDisplay,
} from '@/types/orderbook'
import { DURATION_RANGES } from '@/types/orderbook'

export function OPTIONS(request: NextRequest) {
  return handleOptions(request)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a hex address for comparison (lowercase, keep 0x prefix). */
function norm(addr: string): string {
  return addr.toLowerCase()
}

/** Safely parse order_data that might be a string or already-parsed object. */
function parseOrderData(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>
  return raw
}

interface AssetEntry {
  address: string
  /** SDK format uses asset_address, D1 format uses address — handle both */
  asset_address?: string
  type: string
  value: string
  tokenId?: string
}

/** Get the token address from an asset entry (handles both SDK and D1 formats) */
function assetAddr(entry: AssetEntry): string {
  return entry.asset_address ?? entry.address ?? ''
}

/** Extract the primary numeric value (as bigint) from an asset array. */
function primaryValue(assets: AssetEntry[]): bigint {
  if (!assets || assets.length === 0) return 0n
  return BigInt(assets[0].value ?? '0')
}

/**
 * Compute annualized percentage rate for a lending order.
 * Values are normalized by their respective token decimals so cross-token
 * comparisons (e.g. mUSDC 6-dec debt vs mWETH 18-dec interest) are correct.
 */
function computeAPR(
  debtValue: bigint,
  debtDecimals: number,
  interestValue: bigint,
  interestDecimals: number,
  durationSeconds: number,
): number {
  if (debtValue === 0n || durationSeconds <= 0) return 0
  if (interestValue === 0n) return 0
  const YEAR_SECONDS = 365 * 86400
  // Normalize to human-readable amounts using respective decimals
  const normDebt = Number(debtValue) / Math.pow(10, debtDecimals)
  const normInterest = Number(interestValue) / Math.pow(10, interestDecimals)
  if (normDebt === 0) return 0
  return (normInterest / normDebt) * (YEAR_SECONDS / durationSeconds) * 100
}

/** Compute exchange rate for a swap order: debt per collateral. */
function computeRate(debtValue: bigint, collateralValue: bigint): number {
  if (collateralValue === 0n) return 0
  return Number(debtValue) / Number(collateralValue)
}

/** Round APR to 0.1% bands. */
function roundAPR(apr: number): number {
  return Math.round(apr * 10) / 10
}

/** Round rate to 6 significant digits. */
function roundRate(rate: number): number {
  if (rate === 0) return 0
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rate))))
  return Math.round((rate / magnitude) * 1e6) / 1e6 * magnitude
}

/** Build a TokenDisplay from an address, falling back to a generic entry. */
function buildTokenDisplay(address: string): TokenDisplay {
  const info = findTokenByAddress(address)
  return {
    address,
    symbol: info?.symbol ?? 'UNKNOWN',
    decimals: info?.decimals ?? 18,
    logoUrl: info?.logoUrl,
  }
}

/** Check if a duration (seconds) falls within the selected filter range. */
function matchesDurationFilter(durationSeconds: number, filter: DurationFilter): boolean {
  const range = DURATION_RANGES[filter]
  if (!range) return true // 'all'
  return durationSeconds >= range[0] && durationSeconds < range[1]
}

// ---------------------------------------------------------------------------
// Intermediate normalized order shape
// ---------------------------------------------------------------------------

interface NormalizedOrder {
  id: string
  creator: string
  source: 'offchain' | 'onchain'
  debtValue: bigint
  interestValue: bigint
  interestTokenAddress: string
  collateralValue: bigint
  duration: number
  deadline: number
  multiLender: boolean
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pair: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { pair } = await params
  const parts = pair.split('_')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return errorResponse('invalid pair format — expected {debtToken}_{collateralToken}', 400, request)
  }

  const debtToken = norm(parts[0])
  const collateralToken = norm(parts[1])

  const durationParam = (request.nextUrl.searchParams.get('duration') ?? 'all') as DurationFilter
  if (!DURATION_RANGES[durationParam] && durationParam !== 'all') {
    return errorResponse('invalid duration filter', 400, request)
  }

  try {
    const db = getD1()

    // Fetch off-chain orders (pending for book, settled for fills)
    const [pendingOrders, settledOrders, reversePendingOrders] = await Promise.all([
      db.getOrders({ status: 'pending', page: 1, limit: 200 }),
      db.getOrders({ status: 'settled', page: 1, limit: 200 }),
      db.getOrders({ status: 'pending', page: 1, limit: 200 }), // will filter for reverse pair
    ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]]

    // Fetch on-chain inscriptions (open for book, filled/repaid for fills)
    const [openInscriptions, filledInscriptions] = await Promise.all([
      db.getInscriptions({ status: 'open', page: 1, limit: 200 }),
      db.getInscriptions({ status: 'filled', page: 1, limit: 200 }),
    ]) as [Record<string, unknown>[], Record<string, unknown>[]]

    // Get assets for all inscriptions we care about
    const allInscriptionIds = [
      ...openInscriptions.map((i) => i.id as string),
      ...filledInscriptions.map((i) => i.id as string),
    ]
    const allAssets = allInscriptionIds.length > 0
      ? (await db.getAssetsForInscriptions(allInscriptionIds)) as Record<string, unknown>[]
      : []

    // Group assets by inscription_id
    const assetMap = new Map<string, Record<string, unknown>[]>()
    for (const asset of allAssets) {
      const key = asset.inscription_id as string
      if (!assetMap.has(key)) assetMap.set(key, [])
      assetMap.get(key)!.push(asset)
    }

    // -----------------------------------------------------------------------
    // Normalize off-chain PENDING orders → this pair (asks)
    // -----------------------------------------------------------------------
    const askOrders: NormalizedOrder[] = []
    for (const order of pendingOrders) {
      const dt = norm(String(order.debt_token ?? ''))
      const ct = norm(String(order.collateral_token ?? ''))
      if (dt !== debtToken || ct !== collateralToken) continue

      const data = parseOrderData(order.order_data as string | Record<string, unknown>)
      const debtAssets = (data.debtAssets ?? []) as AssetEntry[]
      const interestAssets = (data.interestAssets ?? []) as AssetEntry[]
      const collateralAssets = (data.collateralAssets ?? []) as AssetEntry[]
      const duration = Number(data.duration ?? order.duration_seconds ?? 0)

      if (!matchesDurationFilter(duration, durationParam)) continue

      askOrders.push({
        id: order.id as string,
        creator: (data.borrower ?? order.borrower) as string,
        source: 'offchain',
        debtValue: primaryValue(debtAssets),
        interestValue: primaryValue(interestAssets),
        interestTokenAddress: interestAssets.length > 0 ? norm(assetAddr(interestAssets[0])) : '',
        collateralValue: primaryValue(collateralAssets),
        duration,
        deadline: Number(order.deadline ?? 0),
        multiLender: Boolean(data.multiLender),
      })
    }

    // -----------------------------------------------------------------------
    // Normalize off-chain PENDING orders → reverse pair (bids for swaps)
    // -----------------------------------------------------------------------
    const bidOrders: NormalizedOrder[] = []
    for (const order of reversePendingOrders) {
      const dt = norm(String(order.debt_token ?? ''))
      const ct = norm(String(order.collateral_token ?? ''))
      // Reverse pair: their debt is our collateral, their collateral is our debt
      if (dt !== collateralToken || ct !== debtToken) continue

      const data = parseOrderData(order.order_data as string | Record<string, unknown>)
      const debtAssets = (data.debtAssets ?? []) as AssetEntry[]
      const interestAssets = (data.interestAssets ?? []) as AssetEntry[]
      const collateralAssets = (data.collateralAssets ?? []) as AssetEntry[]
      const duration = Number(data.duration ?? order.duration_seconds ?? 0)

      // Only swaps (duration=0) have a two-sided book
      if (duration !== 0) continue

      bidOrders.push({
        id: order.id as string,
        creator: (data.borrower ?? order.borrower) as string,
        source: 'offchain',
        debtValue: primaryValue(debtAssets),
        interestValue: primaryValue(interestAssets),
        interestTokenAddress: interestAssets.length > 0 ? norm(assetAddr(interestAssets[0])) : '',
        collateralValue: primaryValue(collateralAssets),
        duration,
        deadline: Number(order.deadline ?? 0),
        multiLender: Boolean(data.multiLender),
      })
    }

    // -----------------------------------------------------------------------
    // Normalize on-chain OPEN inscriptions → this pair
    // -----------------------------------------------------------------------
    for (const insc of openInscriptions) {
      const assets = assetMap.get(insc.id as string) ?? []

      const debtAssets = assets.filter((a) => a.asset_role === 'debt')
      const interestAssets = assets.filter((a) => a.asset_role === 'interest')
      const collateralAssets = assets.filter((a) => a.asset_role === 'collateral')

      // Match the pair — first debt asset address = debtToken, first collateral asset = collateralToken
      const firstDebtAddr = debtAssets.length > 0 ? norm(String(debtAssets[0].asset_address ?? '')) : ''
      const firstCollateralAddr = collateralAssets.length > 0 ? norm(String(collateralAssets[0].asset_address ?? '')) : ''

      if (firstDebtAddr !== debtToken || firstCollateralAddr !== collateralToken) continue

      const duration = Number(insc.duration ?? 0)
      if (!matchesDurationFilter(duration, durationParam)) continue

      const debtVal = debtAssets.length > 0 ? BigInt(String(debtAssets[0].value ?? '0')) : 0n
      const interestVal = interestAssets.length > 0 ? BigInt(String(interestAssets[0].value ?? '0')) : 0n
      const interestAddr = interestAssets.length > 0 ? norm(String(interestAssets[0].asset_address ?? '')) : ''
      const collateralVal = collateralAssets.length > 0 ? BigInt(String(collateralAssets[0].value ?? '0')) : 0n

      askOrders.push({
        id: insc.id as string,
        creator: (insc.creator ?? insc.borrower ?? '') as string,
        source: 'onchain',
        debtValue: debtVal,
        interestValue: interestVal,
        interestTokenAddress: interestAddr,
        collateralValue: collateralVal,
        duration,
        deadline: Number(insc.deadline ?? 0),
        multiLender: Boolean(insc.multi_lender),
      })
    }

    // -----------------------------------------------------------------------
    // Separate lending (duration > 0) vs swaps (duration = 0)
    // -----------------------------------------------------------------------
    const lendingAsks = askOrders.filter((o) => o.duration > 0)
    const swapAsks = askOrders.filter((o) => o.duration === 0)

    // Collect all unique durations
    const durationSet = new Set<number>()
    for (const o of askOrders) {
      if (o.duration > 0) durationSet.add(o.duration)
    }
    const durations = [...durationSet].sort((a, b) => a - b)

    // -----------------------------------------------------------------------
    // Group lending orders by APR band
    // -----------------------------------------------------------------------
    const lendingLevelMap = new Map<number, LendingLevel>()
    for (const o of lendingAsks) {
      const debtDecimals = buildTokenDisplay(debtToken).decimals
      const interestDecimals = o.interestTokenAddress ? buildTokenDisplay(o.interestTokenAddress).decimals : debtDecimals
      const apr = roundAPR(computeAPR(o.debtValue, debtDecimals, o.interestValue, interestDecimals, o.duration))
      if (!lendingLevelMap.has(apr)) {
        lendingLevelMap.set(apr, {
          apr,
          totalAmount: '0',
          orderCount: 0,
          cumulative: '0',
          orders: [],
        })
      }
      const level = lendingLevelMap.get(apr)!
      level.totalAmount = String(BigInt(level.totalAmount) + o.debtValue)
      level.orderCount += 1
      level.orders.push({
        id: o.id,
        amount: String(o.debtValue),
        creator: o.creator,
        source: o.source,
        duration: o.duration,
        multiLender: o.multiLender,
        deadline: o.deadline,
        interestAmount: String(o.interestValue),
        interestSymbol: findTokenByAddress(o.interestTokenAddress)?.symbol ?? 'UNKNOWN',
        interestDecimals: findTokenByAddress(o.interestTokenAddress)?.decimals ?? 18,
      })
    }

    // Sort highest APR first (best for lenders)
    const lendingLevels = [...lendingLevelMap.values()].sort((a, b) => b.apr - a.apr)

    // Compute cumulative depths
    let lendingCum = 0n
    for (const level of lendingLevels) {
      lendingCum += BigInt(level.totalAmount)
      level.cumulative = String(lendingCum)
    }

    const totalAskLendingVolume = String(lendingCum)

    // -----------------------------------------------------------------------
    // Group swap asks by rate band
    // -----------------------------------------------------------------------
    const swapAskMap = new Map<number, SwapLevel>()
    for (const o of swapAsks) {
      const rate = roundRate(computeRate(o.debtValue, o.collateralValue))
      if (!swapAskMap.has(rate)) {
        swapAskMap.set(rate, {
          rate,
          totalAmount: '0',
          orderCount: 0,
          cumulative: '0',
          orders: [],
        })
      }
      const level = swapAskMap.get(rate)!
      level.totalAmount = String(BigInt(level.totalAmount) + o.debtValue)
      level.orderCount += 1
      level.orders.push({
        id: o.id,
        amount: String(o.debtValue),
        creator: o.creator,
        source: o.source,
        deadline: o.deadline,
      })
    }

    // Sort lowest rate first (best price for buyers)
    const swapAskLevels = [...swapAskMap.values()].sort((a, b) => a.rate - b.rate)

    let swapAskCum = 0n
    for (const level of swapAskLevels) {
      swapAskCum += BigInt(level.totalAmount)
      level.cumulative = String(swapAskCum)
    }

    // -----------------------------------------------------------------------
    // Group swap bids by rate band (reverse pair orders)
    // -----------------------------------------------------------------------
    const swapBidMap = new Map<number, SwapLevel>()
    for (const o of bidOrders) {
      // For bids: rate is how much of our base (debtToken) per unit of quote (collateralToken)
      // Reverse direction: their debt=collateralToken, their collateral=debtToken
      // Rate from buyer perspective: collateralValue (our debtToken) / debtValue (our collateralToken)
      const rate = o.debtValue > 0n ? roundRate(Number(o.collateralValue) / Number(o.debtValue)) : 0
      if (!swapBidMap.has(rate)) {
        swapBidMap.set(rate, {
          rate,
          totalAmount: '0',
          orderCount: 0,
          cumulative: '0',
          orders: [],
        })
      }
      const level = swapBidMap.get(rate)!
      // Amount in terms of our base token (their collateral)
      level.totalAmount = String(BigInt(level.totalAmount) + o.collateralValue)
      level.orderCount += 1
      level.orders.push({
        id: o.id,
        amount: String(o.collateralValue),
        creator: o.creator,
        source: o.source,
        deadline: o.deadline,
      })
    }

    // Sort highest rate first (best price for sellers)
    const swapBidLevels = [...swapBidMap.values()].sort((a, b) => b.rate - a.rate)

    let swapBidCum = 0n
    for (const level of swapBidLevels) {
      swapBidCum += BigInt(level.totalAmount)
      level.cumulative = String(swapBidCum)
    }

    // -----------------------------------------------------------------------
    // Recent fills — settled off-chain orders + filled/repaid on-chain inscriptions
    // -----------------------------------------------------------------------
    const recentFills: OrderBookResponse['recentFills'] = []

    // Off-chain settled orders for this pair
    const settledForPair = settledOrders
      .filter((o) => {
        const dt = norm(String(o.debt_token ?? ''))
        const ct = norm(String(o.collateral_token ?? ''))
        return dt === debtToken && ct === collateralToken
      })
      .slice(0, 10)

    for (const order of settledForPair) {
      const data = parseOrderData(order.order_data as string | Record<string, unknown>)
      const debtAssets = (data.debtAssets ?? []) as AssetEntry[]
      const interestAssets = (data.interestAssets ?? []) as AssetEntry[]
      const collateralAssets = (data.collateralAssets ?? []) as AssetEntry[]
      const duration = Number(data.duration ?? order.duration_seconds ?? 0)
      const dv = primaryValue(debtAssets)
      const iv = primaryValue(interestAssets)
      const cv = primaryValue(collateralAssets)

      const fillDebtDec = buildTokenDisplay(debtToken).decimals
      const fillInterestAddr = interestAssets.length > 0 ? norm(assetAddr(interestAssets[0])) : ''
      const fillInterestDec = fillInterestAddr ? buildTokenDisplay(fillInterestAddr).decimals : fillDebtDec

      recentFills.push({
        id: order.id as string,
        apr: duration > 0 ? computeAPR(dv, fillDebtDec, iv, fillInterestDec, duration) : 0,
        rate: duration === 0 ? computeRate(dv, cv) : 0,
        amount: String(dv),
        duration,
        filledAt: Number(order.created_at ?? 0),
        source: 'offchain',
        type: duration > 0 ? 'lending' : 'swap',
      })
    }

    // On-chain filled/repaid inscriptions for this pair
    const repaidInscriptions = (await db.getInscriptions({ status: 'repaid', page: 1, limit: 200 })) as Record<string, unknown>[]
    const onchainFillCandidates = [...filledInscriptions, ...repaidInscriptions]

    for (const insc of onchainFillCandidates) {
      const assets = assetMap.get(insc.id as string) ?? []
      const debtAssets = assets.filter((a) => a.asset_role === 'debt')
      const collateralAssets = assets.filter((a) => a.asset_role === 'collateral')
      const interestAssets = assets.filter((a) => a.asset_role === 'interest')

      const firstDebtAddr = debtAssets.length > 0 ? norm(String(debtAssets[0].asset_address ?? '')) : ''
      const firstCollateralAddr = collateralAssets.length > 0 ? norm(String(collateralAssets[0].asset_address ?? '')) : ''

      if (firstDebtAddr !== debtToken || firstCollateralAddr !== collateralToken) continue

      const duration = Number(insc.duration ?? 0)
      const dv = debtAssets.length > 0 ? BigInt(String(debtAssets[0].value ?? '0')) : 0n
      const iv = interestAssets.length > 0 ? BigInt(String(interestAssets[0].value ?? '0')) : 0n
      const cv = collateralAssets.length > 0 ? BigInt(String(collateralAssets[0].value ?? '0')) : 0n
      const onchainInterestAddr = interestAssets.length > 0 ? norm(String(interestAssets[0].asset_address ?? '')) : ''
      const onchainDebtDec = buildTokenDisplay(debtToken).decimals
      const onchainInterestDec = onchainInterestAddr ? buildTokenDisplay(onchainInterestAddr).decimals : onchainDebtDec

      recentFills.push({
        id: insc.id as string,
        apr: duration > 0 ? computeAPR(dv, onchainDebtDec, iv, onchainInterestDec, duration) : 0,
        rate: duration === 0 ? computeRate(dv, cv) : 0,
        amount: String(dv),
        duration,
        filledAt: Number(insc.updated_at_ts ?? insc.created_at_ts ?? 0),
        source: 'onchain',
        type: duration > 0 ? 'lending' : 'swap',
      })
    }

    // Sort by most recent first, limit to 10
    recentFills.sort((a, b) => b.filledAt - a.filledAt)
    recentFills.splice(10)

    // -----------------------------------------------------------------------
    // Build response
    // -----------------------------------------------------------------------
    const response: OrderBookResponse = {
      pair: {
        base: buildTokenDisplay(debtToken),
        quote: buildTokenDisplay(collateralToken),
      },
      durations,
      lending: {
        asks: lendingLevels,
        totalAskVolume: totalAskLendingVolume,
      },
      swaps: {
        asks: swapAskLevels,
        bids: swapBidLevels,
        totalAskVolume: String(swapAskCum),
        totalBidVolume: String(swapBidCum),
      },
      recentFills,
    }

    return jsonResponse(response, request)
  } catch (err) {
    logError('orderbook', err)
    return errorResponse('service unavailable', 502, request)
  }
}
