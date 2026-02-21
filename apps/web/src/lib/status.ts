import { computeStatus as sdkComputeStatus } from '@fepvenancio/stela-sdk'
import type { StatusInput } from '@fepvenancio/stela-sdk'
import type { InscriptionStatus } from '@stela/core'

export type { StatusInput }

/**
 * Delegates to the SDK's computeStatus — single source of truth.
 * Handles: deadline expiry for open inscriptions, cancelled status,
 * partial/filled/expired for signed inscriptions.
 */
export function computeStatus(a: StatusInput): InscriptionStatus {
  return sdkComputeStatus(a)
}
