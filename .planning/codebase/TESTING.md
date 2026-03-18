# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- No test runner configured. Zero test files found across the entire monorepo.
- No `jest.config.*`, `vitest.config.*`, or equivalent detected.
- No `*.test.*` or `*.spec.*` files found anywhere in `apps/`, `packages/`, `workers/`, or `services/`.

**Assertion Library:**
- Not applicable — no testing library installed.

**Run Commands:**
```bash
# No test commands exist. The package.json scripts are:
pnpm build     # build all packages via Turborepo
pnpm lint      # type-check via tsc --noEmit
pnpm dev       # start dev servers
```

## Test File Organization

**Location:**
- No test files exist. No test directories (`__tests__/`, `tests/`, `test/`) detected.

**Naming:**
- No established pattern — no test files to observe.

## What Exists Instead of Tests

The codebase uses several compile-time and runtime mechanisms as quality controls:

**TypeScript Strict Mode (`tsconfig.base.json`):**
- `"strict": true` catches null/undefined errors, implicit `any`, and type mismatches at build time
- `pnpm lint` runs `tsc --noEmit` as a type-check gate
- All packages extend `tsconfig.base.json` with strict settings

**Zod Runtime Validation:**
- All external inputs validated with Zod schemas at runtime:
  - API request bodies: `apps/web/src/lib/validation.ts`
  - Webhook payloads: `workers/indexer/src/schemas.ts`
  - Query parameters: `apps/web/src/lib/schemas.ts`
- Schema definitions double as documentation of valid input shapes
- `safeParse` used everywhere — failures return structured Zod error issues

**Input Allowlists for Security (`packages/core/src/d1.ts`):**
- `INSCRIPTION_COLUMNS` Set prevents SQL injection in dynamic upserts
- `VALID_ORDER_STATUSES` and `VALID_OFFER_STATUSES` Sets validate status transitions
- Applied via `isValidStatus()` guard before any DB write

**Error Boundary (`apps/web/src/components/ErrorBoundary.tsx`):**
- Catches React render errors in production

## Coverage

**Requirements:** None enforced — no coverage tooling installed.

**Current coverage:** 0% — no automated tests exist.

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:** Not present.

## Priority Areas for Future Test Addition

If tests are added, the highest-value areas to cover first:

**`packages/core/src/d1.ts`** — All D1 query functions. Used by every app and worker. Logic includes dynamic column allowlisting, status validation, and complex JOIN queries.

**`packages/core/src/u256.ts`** — `toU256`, `fromU256`, `inscriptionIdToHex`, `normalizeAddress`. StarkNet u256 math is failure-critical; a bug here corrupts inscription IDs across the stack.

**`apps/web/src/lib/rate-limit.ts`** — Sliding-window rate limiter logic. Pure functions with no external dependencies — easily unit tested.

**`apps/web/src/lib/validation.ts`** — Zod schema edge cases: felt252 boundary values, signature format normalization, deadline range validation.

**`apps/web/src/lib/errors.ts`** — Error hierarchy and `errorResponse` overload resolution in `apps/web/src/lib/api.ts`.

**`workers/bot/src/index.ts`** — Settlement calldata construction and nonce-expiry logic. Currently untested; bugs cause silent on-chain failures.

## Recommended Test Stack (if adding tests)

Given the Cloudflare Workers + Node.js mixed runtime environment:

```bash
# For packages/core and apps/web/src/lib utilities (pure TS):
vitest           # fast, ESM-native, no config needed for pure TS

# For workers (Cloudflare Workers runtime):
@cloudflare/vitest-pool-workers   # runs tests inside workerd

# For API routes (Next.js):
vitest + @opennextjs/cloudflare test utilities
```

**Example unit test structure (vitest):**
```typescript
// packages/core/src/u256.test.ts
import { describe, it, expect } from 'vitest'
import { toU256, fromU256, inscriptionIdToHex } from './u256.js'

describe('toU256', () => {
  it('splits bigint into [low, high] calldata pair', () => {
    expect(toU256(0x123n)).toEqual(['0x123', '0x0'])
  })

  it('handles values requiring high word', () => {
    const val = (2n ** 128n) + 1n
    const [low, high] = toU256(val)
    expect(BigInt(low)).toBe(1n)
    expect(BigInt(high)).toBe(1n)
  })
})
```

**Example Zod schema test:**
```typescript
// apps/web/src/lib/validation.test.ts
import { describe, it, expect } from 'vitest'
import { createOrderSchema } from './validation.js'

describe('createOrderSchema', () => {
  it('rejects deadline in the past', () => {
    const result = createOrderSchema.safeParse({ deadline: 1000, ... })
    expect(result.success).toBe(false)
  })

  it('accepts signature as [r, s] array', () => {
    // ...
  })
})
```

---

*Testing analysis: 2026-03-18*
