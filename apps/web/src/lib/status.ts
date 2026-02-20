import type { Agreement, AgreementStatus } from '@stela/core'
import { MAX_BPS } from '@stela/core'

export function computeStatus(a: Agreement): AgreementStatus {
  if (a.is_repaid) return 'repaid'
  if (a.liquidated) return 'liquidated'
  if (a.issued_debt_percentage === 0n) return 'open'

  const now = BigInt(Math.floor(Date.now() / 1000))
  const dueAt = a.signed_at + a.duration

  if (a.signed_at > 0n && now > dueAt) return 'expired'
  if (a.issued_debt_percentage === MAX_BPS) return 'filled'
  return 'partial'
}
