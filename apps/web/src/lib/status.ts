import { computeStatus as sdkComputeStatus, STATUS_LABELS, GRACE_PERIOD } from '@fepvenancio/stela-sdk'
import type { StatusInput } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'

export type { StatusInput }

// ── Badge variant types ─────────────────────────────────────────────

export type StatusBadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'overdue' | 'cancelled' | 'pending' | 'matched' | 'settled' | 'auctioned' | 'grace_period'

// Extended labels for statuses not in the SDK
const EXTENDED_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  auctioned: 'Auctioned',
  grace_period: 'Grace Period',
}

/** Map any status string to a valid badge variant, defaulting to 'open'. */
export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  if (status === 'overdue') return 'overdue'
  if (status === 'auctioned') return 'auctioned'
  if (status === 'grace_period') return 'grace_period'
  return (status in STATUS_LABELS ? status : 'open') as StatusBadgeVariant
}

/** Map any status string to its human-readable label. */
export function getStatusLabel(status: string): string {
  return EXTENDED_LABELS[status] ?? (STATUS_LABELS as Record<string, string>)[status] ?? status
}

// ── Off-chain order status helpers ──────────────────────────────────

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  matched: 'Matched',
  settled: 'Settled',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

/** Map off-chain order status to its own badge variant. */
export function getOrderStatusBadgeVariant(status: string): StatusBadgeVariant {
  const map: Record<string, StatusBadgeVariant> = {
    pending: 'pending',
    matched: 'matched',
    settled: 'settled',
    expired: 'expired',
    cancelled: 'cancelled',
  }
  return map[status] ?? 'pending'
}

/** Get the human-readable label for an off-chain order status. */
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status
}

// ── Filter group mappings ───────────────────────────────────────────

/** Enriched inscription statuses that belong to each filter group. */
export const INSCRIPTION_STATUS_GROUPS: Record<string, Set<string>> = {
  open: new Set(['open', 'partial']),
  active: new Set(['filled', 'auctioned', 'grace_period']),
  closed: new Set(['repaid', 'liquidated', 'expired', 'overdue', 'cancelled']),
}

/** Off-chain order statuses that belong to each filter group. */
export const ORDER_STATUS_GROUPS: Record<string, Set<string>> = {
  open: new Set(['pending']),
  active: new Set(['matched']),
  closed: new Set(['settled', 'expired', 'cancelled']),
}

/** Check if an enriched inscription status belongs to a filter group. */
export function inscriptionMatchesGroup(enrichedStatus: string, group: string): boolean {
  if (group === 'all') return true
  return INSCRIPTION_STATUS_GROUPS[group]?.has(enrichedStatus) ?? false
}

/** Check if an order status belongs to a filter group. */
export function orderMatchesGroup(orderStatus: string, group: string): boolean {
  if (group === 'all') return true
  return ORDER_STATUS_GROUPS[group]?.has(orderStatus) ?? false
}

// ── Descriptions for tooltips ───────────────────────────────────────

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  open: 'Waiting for a lender to sign. The borrower has set the loan terms.',
  partial: 'Partially funded by lenders. More lenders can still contribute.',
  filled: 'Fully funded and active. The borrower received the debt tokens.',
  repaid: 'The borrower repaid the loan. Lenders can redeem their shares.',
  liquidated: 'Loan expired without repayment. Collateral distributed to lenders.',
  overdue: 'Loan duration elapsed without repayment. Anyone can liquidate.',
  auctioned: 'Auction started. The collateral is being sold to the highest bidder.',
  grace_period: 'Loan expired but within the 24-hour grace period. The borrower can still repay.',
  expired: 'Expired before being funded. No lender action was taken.',
  cancelled: 'Cancelled by the borrower before any lender signed.',
  pending: 'Gasless order waiting for a lender offer. No gas was spent.',
  matched: 'A lender offered. The settlement bot will execute it shortly.',
  settled: 'Settled on-chain. The loan is now active as an inscription.',
}

export const CONCEPT_DESCRIPTIONS: Record<string, string> = {
  debt: 'Tokens the borrower wants to borrow. Lenders provide these.',
  interest: 'Extra tokens the borrower pays as reward for the lender.',
  collateral: 'Tokens locked by the borrower as security for the loan.',
  duration: 'How long the borrower has to repay after funding.',
  apy: 'Annual Percentage Yield — annualized return for lenders.',
  offChain: 'Gasless orders signed off-chain. No gas until settlement.',
  shares: 'ERC1155 tokens representing a lender\'s portion of a loan.',
}

// ── SDK delegation ──────────────────────────────────────────────────

/**
 * Delegates to the SDK's computeStatus — single source of truth.
 * Handles: deadline expiry for open inscriptions, cancelled status,
 * partial/filled/expired for signed inscriptions.
 */
export function computeStatus(a: StatusInput): InscriptionStatus {
  return sdkComputeStatus(a)
}

/** Enrich an InscriptionRow with a client-side computed status.
 *  Distinguishes "overdue" (filled past duration) from "expired" (unfilled past deadline). */
export function enrichStatus(row: {
  status: string
  signed_at: string | null
  duration: string
  issued_debt_percentage: string
  deadline: string
  auction_started?: number
}): string {
  const base = computeStatus({
    signed_at: BigInt(row.signed_at ?? '0'),
    duration: BigInt(row.duration),
    issued_debt_percentage: BigInt(row.issued_debt_percentage),
    is_repaid: row.status === 'repaid',
    liquidated: row.status === 'liquidated',
    deadline: BigInt(row.deadline ?? '0'),
    status: row.status,
  })
  // Auction started — collateral is being auctioned off
  if (row.auction_started) {
    return 'auctioned'
  }

  // Distinguish overdue/grace_period (filled loan past duration) from expired (unfilled past deadline)
  if (base === 'expired' && row.signed_at && BigInt(row.signed_at) > 0n) {
    const signedAt = BigInt(row.signed_at)
    const duration = BigInt(row.duration)
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
    const expiryTime = signedAt + duration
    // Grace period — loan expired but borrower can still repay within GRACE_PERIOD
    if (nowSeconds <= expiryTime + GRACE_PERIOD) {
      return 'grace_period'
    }
    // Past grace period — overdue, anyone can liquidate
    return 'overdue'
  }

  return base
}
