/**
 * Zod validation schemas for API request bodies.
 *
 * Validates structure, types, and StarkNet-specific constraints
 * (felt252 range, address format, signature format).
 */

import { z } from 'zod'

/**
 * A valid StarkNet felt252: 0x-prefixed hex string, 1-63 hex digits after prefix.
 * Represents values in the range [0, P) where P is the StarkNet prime (~2^251).
 */
const felt = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,63}$/i, 'Must be a 0x-prefixed hex string with 1-63 hex digits')

/**
 * A StarkNet contract address: 0x-prefixed hex string, 1-64 hex digits.
 * Addresses can be up to 256 bits (64 hex chars) for full padding.
 */
const starknetAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/i, 'Must be a valid StarkNet address')

/**
 * A StarkNet ECDSA signature: exactly 2 felt252 values [r, s].
 *
 * Accepts either:
 * - An array of 2 hex strings: ["0x...", "0x..."]
 * - A JSON string that parses to such an array
 * - An object with { r, s } fields
 */
const signatureArray = z
  .array(felt)
  .length(2, 'Signature must contain exactly 2 elements [r, s]')

/**
 * Flexible signature input: accepts array, JSON string, or {r, s} object.
 * Always normalizes to string[] of 2 felt values.
 */
export const signatureInput = z
  .union([
    // Direct array
    signatureArray,
    // JSON string that parses to an array
    z.string().transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val)
        if (!Array.isArray(parsed) || parsed.length !== 2) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Signature JSON must be an array of 2 elements' })
          return z.NEVER
        }
        return parsed as string[]
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid signature JSON' })
        return z.NEVER
      }
    }),
    // Object with r, s
    z.object({ r: felt, s: felt }).transform((val) => [val.r, val.s]),
  ])
  .pipe(signatureArray)

/** Serialized asset in order_data */
const serializedAsset = z.object({
  asset_address: starknetAddress,
  asset_type: z.enum(['ERC20', 'ERC721', 'ERC1155', 'ERC4626']),
  value: z.string(),
  token_id: z.string().optional().default('0'),
})

/** Order data nested object -- the full description of the loan terms */
const orderDataSchema = z.object({
  borrower: starknetAddress,
  debtAssets: z.array(serializedAsset).min(1, 'At least one debt asset is required'),
  interestAssets: z.array(serializedAsset).default([]),
  collateralAssets: z.array(serializedAsset).min(1, 'At least one collateral asset is required'),
  duration: z.string(),
  deadline: z.string(),
  multiLender: z.boolean().default(false),
  nonce: z.string(),
  orderHash: z.string().optional(),
  debtHash: z.string().optional(),
  interestHash: z.string().optional(),
  collateralHash: z.string().optional(),
})

/** POST /api/orders request body */
export const createOrderSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  borrower: starknetAddress,
  order_data: z.union([orderDataSchema, z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = orderDataSchema.safeParse(parsed)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join('; ')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid order_data: ${messages}` })
        return z.NEVER
      }
      return result.data
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid order_data JSON' })
      return z.NEVER
    }
  })]),
  borrower_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer'),
})

/** POST /api/orders/:id/offer request body */
export const createOfferSchema = z.object({
  id: z.string().min(1, 'Offer ID is required'),
  lender: starknetAddress,
  bps: z.coerce.number().int().min(1, 'BPS must be at least 1').max(10000, 'BPS must be at most 10000'),
  lender_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
})

/** DELETE /api/orders/:id request body */
export const cancelOrderSchema = z.object({
  borrower: starknetAddress,
  signature: signatureInput,
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
