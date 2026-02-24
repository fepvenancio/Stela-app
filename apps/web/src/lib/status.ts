import { computeStatus as sdkComputeStatus } from '@fepvenancio/stela-sdk'
import type { StatusInput } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@fepvenancio/stela-sdk'

export type { StatusInput }

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
