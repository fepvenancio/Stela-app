import { z } from 'zod'
import { VALID_STATUSES } from '@stela/core'
import type { InscriptionStatus } from '@stela/core'

/** Hex string pattern matching StarkNet addresses and IDs */
const hex = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, 'Invalid hex string')

/** Inscription list query params */
export const inscriptionListSchema = z.object({
  status: z.enum(VALID_STATUSES as unknown as [InscriptionStatus, ...InscriptionStatus[]]).optional(),
  address: hex.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/** Inscription ID path param */
export const inscriptionIdSchema = z.object({
  id: hex,
})

/** Hex address path param */
export const addressSchema = z.object({
  address: hex,
})
