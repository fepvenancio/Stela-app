# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` (e.g., `InscriptionActions.tsx`, `TokenSelectorModal.tsx`)
- React hooks: camelCase with `use` prefix `.ts` (e.g., `useCreateInscription.ts`, `useTransactionProgress.ts`)
- Utility modules: kebab-case `.ts` (e.g., `rate-limit.ts`, `verify-signature.ts`, `order-utils.ts`)
- UI primitives in `components/ui/`: lowercase kebab `.tsx` (e.g., `button.tsx`, `toggle-group.tsx`)
- Worker entry points: `index.ts` in each `workers/*/src/`

**Functions:**
- Hooks: `useXxx` camelCase
- Utility functions: camelCase (e.g., `formatTokenValue`, `getErrorMessage`, `createD1Queries`)
- Guard/check functions: `isXxx` or `ensureXxx` pattern (e.g., `isRateLimited`, `isStarknetReady`, `ensureStarknetContext`)
- API route handlers: standard Next.js names `GET`, `POST`, `DELETE`, `OPTIONS`

**Variables:**
- camelCase for local variables
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `WINDOW_MS`, `WRITE_MAX`, `TX_TIMEOUT_MS`, `MAX_LIQUIDATIONS_PER_RUN`)
- Database column names: snake_case (matches SQLite schema, e.g., `inscription_id`, `asset_address`, `multi_lender`)

**Types/Interfaces:**
- PascalCase `interface` for object shapes (e.g., `CreateInscriptionInput`, `TransactionProgress`, `StepDefinition`)
- PascalCase `type` for unions and aliases (e.g., `AssetType`, `InscriptionStatus`, `StepStatus`)
- Inferred Zod output types exported as `type Xxx = z.infer<typeof xxxSchema>` (e.g., `CreateOrderInput`, `CreateOfferInput`)

**Zod Schemas:**
- Named `xxxSchema` (e.g., `createOrderSchema`, `webhookPayloadSchema`, `inscriptionListSchema`)
- Reusable primitives named without `Schema` suffix (e.g., `felt`, `starknetAddress`, `signatureArray`)

## Code Style

**Formatting:**
- No Prettier config detected — formatting is handled by Next.js ESLint preset
- Indentation: 2 spaces throughout all packages
- Trailing commas on multi-line expressions (observed consistently)
- Single quotes for imports, double quotes in some JSX attributes

**Linting:**
- ESLint via `apps/web/.eslintrc.json` extending `next/core-web-vitals` and `next/typescript`
- `eslint-disable-next-line react-hooks/exhaustive-deps` used sparingly (6 instances in web app) with inline justification expected
- `@typescript-eslint/no-explicit-any` disabled in exactly one spot (`NetworkMismatchBanner.tsx`) with a comment
- TypeScript strict mode enforced via `tsconfig.base.json` (`"strict": true`)
- No `any` types without justification — `unknown` preferred for caught errors

## Import Organization

**Order (observed pattern):**
1. React and framework imports (`react`, `next/server`, `@starknet-react/core`)
2. External library imports (`starknet`, `zod`, `sonner`)
3. Internal workspace imports (`@stela/core`, `@fepvenancio/stela-sdk`)
4. Path-aliased app imports (`@/lib/...`, `@/hooks/...`, `@/components/...`)
5. Relative imports (`./types.js`, `../handlers/index.js`)

**Path Aliases:**
- `@/*` maps to `apps/web/src/*` (configured in `apps/web/tsconfig.json`)
- Workers and `packages/core` use relative imports with `.js` extension (ESM Node resolution)

**ESM Requirements:**
- All imports in `packages/core` and `workers/` must use `.js` extensions even for `.ts` source files (ESM `"type": "module"`)
- Next.js app uses extensionless `@/` alias imports

## Error Handling

**Custom Error Hierarchy (`apps/web/src/lib/errors.ts`):**
```typescript
AppError          // base: message + statusCode + optional code
  NotFoundError   // 404, 'NOT_FOUND'
  UnauthorizedError // 401, 'UNAUTHORIZED'
  ValidationError // 400, 'VALIDATION_ERROR'
  RateLimitError  // 429, 'RATE_LIMITED'
```

**API Route Pattern:**
- Validate input with Zod `safeParse`, return `errorResponse(message, 400, request)` on failure
- Wrap D1 operations in `try/catch`, return `errorResponse('service unavailable', 502, request)` on DB errors
- `logError(context, err)` called before returning error responses — logs `[err.name]` only, never the message (avoids leaking D1 schema)
- Rate limit check returns early: `const limited = rateLimit(request); if (limited) return limited`

**Client-Side Hook Pattern:**
- `ensureStarknetContext({ address, status })` throws if wallet not connected — callers catch it
- `try/catch/finally` blocks in async hooks: `finally { setIsPending(false) }`
- Caught errors: `const msg = getErrorMessage(err)` then `toast.error(...)` then `throw err`
- `getErrorMessage(err)`: `err instanceof Error ? err.message : String(err)`

**Worker Pattern:**
- `err instanceof Error ? err.message : String(err)` for safe string coercion in `console.error`
- Individual event failures in webhook loop do not abort the batch — errors collected and reported
- Bot operations serialized to avoid StarkNet nonce conflicts; individual failures leave status as-is for retry

**Security — Fail Closed:**
- Rate limit D1 check failure returns 503 (not passes through)
- Nonce verification RPC failure rejects order creation
- Webhook auth uses `crypto.subtle.timingSafeEqual` to prevent timing attacks

## Logging

**Framework:** `console.log` / `console.error` / `console.warn` — no structured logging library

**Patterns:**
- Workers log with context prefix: `` `Failed to process ${event.event_type} (tx: ${event.tx_hash}):`, msg ``
- API routes use `logError(context, err)` from `apps/web/src/lib/api.ts` which logs only `[err.name]`, never the full message
- Bot logs progress counts: `` `Expired ${expired} open inscription(s) past deadline` ``
- `console.warn` used for non-fatal parsing issues in bot (`Failed to parse order_data for order...`)

## Comments

**When to Comment:**
- JSDoc-style `/** ... */` on exported functions and interfaces — especially for non-obvious domain logic
- Single-line `//` for inline explanations of StarkNet/Cairo-specific behavior
- Section dividers using `// ---------------------------------------------------------------------------` for long files (`d1.ts`, `bot/index.ts`, `rate-limit.ts`)
- `'use client'` directive on all React components and hooks that use browser APIs

**JSDoc Usage:**
- Exported functions in `packages/core` and `apps/web/src/lib/` consistently have JSDoc
- Interface properties annotated with `/** ... */` for domain-specific fields (e.g., duration in seconds, deadline as unix timestamp)
- Complex parameters documented at the function level, not per-param `@param` style

## Function Design

**Size:** Functions are single-responsibility; complex flows (e.g., `createInscription`) broken into named helpers (`buildApprovalsIfNeeded`, `isApprovedForAll`)

**Parameters:**
- Object destructuring for functions with 3+ parameters
- Options objects for optional configuration (e.g., `{ chainId, verifySignature, verifyNonce }`)
- Async functions return `Promise<T>` explicitly or via `async/await`

**Return Values:**
- Hooks return `{ actionName, isPending }` object pattern
- API helpers return `NextResponse | null` (null = not rate limited, proceed)
- Query functions return typed results from D1

## Module Design

**Exports:**
- `packages/core/src/index.ts` re-exports everything — consumers import only from `@stela/core`
- Barrel files used only at the package root, not within `apps/web/src`
- Named exports preferred over default exports (exception: Cloudflare Worker `export default { fetch, scheduled }`)
- React components use named exports: `export function ComponentName(...)` not `export default`

**D1 Query Module Pattern:**
- `createD1Queries(db: D1Database)` factory returns a plain object of query methods
- All DB access goes through this factory — never raw SQL outside `packages/core/src/d1.ts`
- Column allowlists (`INSCRIPTION_COLUMNS`, `VALID_ORDER_STATUSES`) protect dynamic upserts

---

*Convention analysis: 2026-03-18*
