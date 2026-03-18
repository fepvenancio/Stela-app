# Quality Standards — Stela App

## TypeScript
- Strict mode enabled
- No `any` type — use `unknown` + type guards
- No `ts-ignore` without comment explaining why

## Testing
- property_based: optional
- Coverage threshold: 80%

## UI Standards
- Mobile-first responsive design
- Radix UI primitives + CVA for component variants
- Tailwind CSS 4 — no inline styles
- Loading states for all async operations
- Error states with user-friendly messages
- Toast notifications via Sonner for mutations

## Data Handling
- All token amounts as BigInt (never Number for u256)
- Format with proper decimal places per token
- React Query for all API data fetching
- Invalidate related queries after mutations
