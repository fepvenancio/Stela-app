import { computeStatus as sdkComputeStatus, STATUS_LABELS } from '@fepvenancio/stela-sdk'
import type { StatusInput } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'

export type { StatusInput }

// ── Badge variant types ─────────────────────────────────────────────

export type StatusBadgeVariant = 'open' | 'partial' | 'filled' | 'repaid' | 'liquidated' | 'expired' | 'cancelled'

/** Map any status string to a valid badge variant, defaulting to 'open'. */
export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  return (status in STATUS_LABELS ? status : 'open') as StatusBadgeVariant
}

/** Map any status string to its human-readable label. */
export function getStatusLabel(status: string): string {
  const variant = getStatusBadgeVariant(status)
  return STATUS_LABELS[variant]
}

// ── Off-chain order status helpers ──────────────────────────────────

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  matched: 'Matched',
  settled: 'Settled',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

/** Map off-chain order status to a badge variant using closest visual match. */
export function getOrderStatusBadgeVariant(status: string): StatusBadgeVariant {
  const map: Record<string, StatusBadgeVariant> = {
    pending: 'open',
    matched: 'partial',
    settled: 'filled',
    expired: 'expired',
    cancelled: 'cancelled',
  }
  return map[status] ?? 'open'
}

/** Get the human-readable label for an off-chain order status. */
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status
}

// ── Map on-chain filter to off-chain filter ─────────────────────────

/** Map an on-chain inscription status filter to the equivalent off-chain order status. */
export function mapInscriptionFilterToOrderFilter(filter: string): string {
  const map: Record<string, string> = {
    open: 'pending',
    partial: 'matched',
    filled: 'settled',
    expired: 'expired',
    all: 'all',
  }
  return map[filter] ?? 'all'
}

// ── Descriptions for tooltips ───────────────────────────────────────

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  open: 'Waiting for a lender to sign. The borrower has set the loan terms.',
  partial: 'Partially funded by lenders. More lenders can still contribute.',
  filled: 'Fully funded and active. The borrower received the debt tokens.',
  repaid: 'The borrower repaid the loan. Lenders can redeem their shares.',
  liquidated: 'Loan expired without repayment. Collateral distributed to lenders.',
  expired: 'Expired before any lender signed. Collateral can be reclaimed.',
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

/** Enrich an InscriptionRow with a client-side computed status */
export function enrichStatus(row: {
  status: string
  signed_at: string | null
  duration: string
  issued_debt_percentage: string
  deadline: string
}): string {
  return computeStatus({
    signed_at: BigInt(row.signed_at ?? '0'),
    duration: BigInt(row.duration),
    issued_debt_percentage: BigInt(row.issued_debt_percentage),
    is_repaid: row.status === 'repaid',
    liquidated: row.status === 'liquidated',
    deadline: BigInt(row.deadline ?? '0'),
    status: row.status,
  })
}
