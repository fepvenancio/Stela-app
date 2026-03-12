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
 * A StarkNet signature: array of string values.
 *
 * Different wallet implementations use different formats:
 * - OpenZeppelin/Argent: [r, s] (2 elements)
 * - Braavos: [signer_type, r, s, ...] (variable length)
 * - Cartridge Controller: session keys, WebAuthn data, etc. (variable length)
 *
 * We accept any string array and pass it through to the account contract's
 * is_valid_signature, which knows how to interpret its own signature format.
 */
const signatureArray = z
  .array(z.string())
  .min(1, 'Signature must contain at least 1 element')

/**
 * Flexible signature input: accepts array, JSON string, or {r, s} object.
 * Normalizes to string[].
 */
export const signatureInput = z
  .union([
    // Direct array of strings
    signatureArray,
    // JSON string that parses to an array
    z.string().transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val)
        if (!Array.isArray(parsed) || parsed.length < 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Signature JSON must be a non-empty array' })
          return z.NEVER
        }
        return parsed.map(String) as string[]
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid signature JSON' })
        return z.NEVER
      }
    }),
    // Object with r, s (legacy format)
    z.object({ r: z.string(), s: z.string() }).transform((val) => [val.r, val.s]),
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
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer').refine(
    (val) => val > Math.floor(Date.now() / 1000) + 60,
    'Deadline must be at least 1 minute in the future'
  ).refine(
    (val) => val < Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    'Deadline cannot be more than 1 year in the future'
  ),
})

/** POST /api/orders/:id/offer request body */
export const createOfferSchema = z.object({
  id: z.string().min(1, 'Offer ID is required'),
  lender: starknetAddress,
  bps: z.coerce.number().int().min(1, 'BPS must be at least 1').max(10000, 'BPS must be at most 10000'),
  lender_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
  tx_hash: z.string().optional(),
})

/** DELETE /api/orders/:id request body */
export const cancelOrderSchema = z.object({
  borrower: starknetAddress,
  signature: signatureInput,
})

// ─── T1 Validation Schemas ──────────────────────────────────────────────

/** Collection offer order data — describes the loan terms for any token in a collection */
const collectionOfferDataSchema = z.object({
  lender: starknetAddress,
  collectionAddress: starknetAddress,
  debtAssets: z.array(serializedAsset).min(1, 'At least one debt asset is required'),
  interestAssets: z.array(serializedAsset).default([]),
  duration: z.string(),
  deadline: z.string(),
  multiLender: z.boolean().default(false),
  nonce: z.string(),
})

/** POST /api/collection-offers — create a collection offer */
export const createCollectionOfferSchema = z.object({
  id: z.string().min(1, 'Offer ID is required'),
  lender: starknetAddress,
  collection_address: starknetAddress,
  order_data: z.union([collectionOfferDataSchema, z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = collectionOfferDataSchema.safeParse(parsed)
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
  lender_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer'),
  debt_token: starknetAddress.optional(),
  collateral_token: starknetAddress.optional(),
})

/** POST /api/collection-offers/:id/accept — borrower accepts with specific token */
export const acceptCollectionOfferSchema = z.object({
  borrower: starknetAddress,
  token_id: z.string().min(1, 'Token ID is required'),
  borrower_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
})

/** Refinance offer data — new lender's terms for refinancing */
const refinanceOfferDataSchema = z.object({
  newLender: starknetAddress,
  inscriptionId: z.string(),
  debtAssets: z.array(serializedAsset).min(1),
  interestAssets: z.array(serializedAsset).default([]),
  nonce: z.string(),
})

/** POST /api/refinances — create a refinance offer */
export const createRefinanceOfferSchema = z.object({
  id: z.string().min(1, 'Offer ID is required'),
  inscription_id: z.string().min(1, 'Inscription ID is required'),
  new_lender: starknetAddress,
  order_data: z.union([refinanceOfferDataSchema, z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = refinanceOfferDataSchema.safeParse(parsed)
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
  lender_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer'),
})

/** POST /api/refinances/:id/approve — borrower approves refinance */
export const approveRefinanceSchema = z.object({
  borrower: starknetAddress,
  borrower_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
})

/** Renegotiation proposal data */
const renegotiationProposalDataSchema = z.object({
  inscriptionId: z.string(),
  proposer: starknetAddress,
  newDuration: z.string().optional(),
  newInterestAssets: z.array(serializedAsset).optional(),
  nonce: z.string(),
})

/** POST /api/renegotiations — create a renegotiation proposal */
export const createRenegotiationSchema = z.object({
  id: z.string().min(1, 'Proposal ID is required'),
  inscription_id: z.string().min(1, 'Inscription ID is required'),
  proposer: starknetAddress,
  proposal_data: z.union([renegotiationProposalDataSchema, z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = renegotiationProposalDataSchema.safeParse(parsed)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join('; ')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid proposal_data: ${messages}` })
        return z.NEVER
      }
      return result.data
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid proposal_data JSON' })
      return z.NEVER
    }
  })]),
  proposer_signature: signatureInput,
  nonce: z.string().min(1, 'Nonce is required'),
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer'),
})

/** Collateral sale offer data */
const collateralSaleOfferDataSchema = z.object({
  inscriptionId: z.string(),
  buyer: starknetAddress,
  price: z.string(),
  nonce: z.string().optional(),
})

/** POST /api/collateral-sales — create a collateral sale offer */
export const createCollateralSaleSchema = z.object({
  id: z.string().min(1, 'Sale ID is required'),
  inscription_id: z.string().min(1, 'Inscription ID is required'),
  buyer: starknetAddress,
  offer_data: z.union([collateralSaleOfferDataSchema, z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val)
      const result = collateralSaleOfferDataSchema.safeParse(parsed)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join('; ')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid offer_data: ${messages}` })
        return z.NEVER
      }
      return result.data
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid offer_data JSON' })
      return z.NEVER
    }
  })]),
  borrower_signature: signatureInput,
  min_price: z.string().min(1, 'Minimum price is required'),
  deadline: z.coerce.number().int().positive('Deadline must be a positive integer'),
})

/** DELETE /api/collection-offers/:id or /api/refinances/:id etc. — cancel by owner (address-only auth) */
export const cancelByOwnerSchema = z.object({
  address: starknetAddress,
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
export type CreateCollectionOfferInput = z.infer<typeof createCollectionOfferSchema>
export type AcceptCollectionOfferInput = z.infer<typeof acceptCollectionOfferSchema>
export type CreateRefinanceOfferInput = z.infer<typeof createRefinanceOfferSchema>
export type ApproveRefinanceInput = z.infer<typeof approveRefinanceSchema>
export type CreateRenegotiationInput = z.infer<typeof createRenegotiationSchema>
export type CreateCollateralSaleInput = z.infer<typeof createCollateralSaleSchema>
export type CancelByOwnerInput = z.infer<typeof cancelByOwnerSchema>
