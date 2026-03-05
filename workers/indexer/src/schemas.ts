import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

const hex = z.string().regex(/^0x[0-9a-fA-F]+$/)
const numericStr = z.string().regex(/^[0-9]+$/)

// ---------------------------------------------------------------------------
// Per-event-type data schemas
// ---------------------------------------------------------------------------

const assetSchema = z.object({
  asset_address: hex,
  asset_type: z.string(),
  value: numericStr,
  token_id: numericStr,
})

export const createdDataSchema = z.object({
  inscription_id: hex,
  creator: hex,
  status: z.literal('open'),
  multi_lender: z.number(),
  duration: z.number(),
  deadline: z.number(),
  debt_asset_count: z.number(),
  interest_asset_count: z.number(),
  collateral_asset_count: z.number(),
  assets: z.object({
    debt: z.array(assetSchema),
    interest: z.array(assetSchema),
    collateral: z.array(assetSchema),
  }),
})

export const signedDataSchema = z.object({
  inscription_id: hex,
  borrower: hex,
  lender: hex,
  status: z.enum(['filled', 'partial']),
  issued_debt_percentage: z.number(),
  locker_address: hex.nullable(),
})

export const cancelledDataSchema = z.object({
  inscription_id: hex,
  creator: hex,
})

export const repaidDataSchema = z.object({
  inscription_id: hex,
  repayer: hex,
})

export const liquidatedDataSchema = z.object({
  inscription_id: hex,
  liquidator: hex,
})

export const redeemedDataSchema = z.object({
  inscription_id: hex,
  redeemer: hex,
  shares: numericStr,
})

export const transferSingleDataSchema = z.object({
  inscription_id: hex,
  from: hex,
  to: hex,
  value: numericStr,
})

export const orderSettledDataSchema = z.object({
  order_id: hex,
  borrower: hex,
  lender: hex,
})

// ---------------------------------------------------------------------------
// Envelope schemas
// ---------------------------------------------------------------------------

const baseEvent = {
  tx_hash: hex,
  block_number: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
} as const

const webhookEventSchema = z.discriminatedUnion('event_type', [
  z.object({ event_type: z.literal('created'), ...baseEvent, data: createdDataSchema }),
  z.object({ event_type: z.literal('signed'), ...baseEvent, data: signedDataSchema }),
  z.object({ event_type: z.literal('cancelled'), ...baseEvent, data: cancelledDataSchema }),
  z.object({ event_type: z.literal('repaid'), ...baseEvent, data: repaidDataSchema }),
  z.object({ event_type: z.literal('liquidated'), ...baseEvent, data: liquidatedDataSchema }),
  z.object({ event_type: z.literal('redeemed'), ...baseEvent, data: redeemedDataSchema }),
  z.object({ event_type: z.literal('transfer_single'), ...baseEvent, data: transferSingleDataSchema }),
  z.object({ event_type: z.literal('order_settled'), ...baseEvent, data: orderSettledDataSchema }),
])

export const webhookPayloadSchema = z.object({
  block_number: z.number().int().nonnegative(),
  events: z.array(webhookEventSchema).max(500),
  cursor: z.string(),
})

export type ValidatedWebhookPayload = z.infer<typeof webhookPayloadSchema>
export type ValidatedWebhookEvent = z.infer<typeof webhookEventSchema>
