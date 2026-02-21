'use client'

/**
 * StarkNet context guard utilities.
 *
 * `ensureStarknetContext` narrows optional wallet state to required types,
 * throwing if prerequisites aren't met. Use it inside transaction handlers.
 *
 * `isStarknetReady` is the non-throwing companion for conditional rendering
 * or `enabled` options on read hooks.
 */

interface StarknetCtx {
  address: string | undefined
  status: string
}

interface ValidStarknetCtx {
  address: string
}

/**
 * Narrows optional StarkNet wallet state to connected types.
 * Throws if the wallet is not connected, so callers get a guaranteed address.
 */
export function ensureStarknetContext(ctx: StarknetCtx): ValidStarknetCtx {
  if (!ctx.address || ctx.status !== 'connected') {
    throw new Error('Wallet not connected')
  }
  return { address: ctx.address }
}

/**
 * Non-throwing companion: returns true when the wallet is connected and ready.
 * Use for `enabled` guards or conditional rendering.
 */
export function isStarknetReady(ctx: StarknetCtx): boolean {
  return Boolean(ctx.address) && ctx.status === 'connected'
}
