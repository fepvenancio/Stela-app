# Security Checklist — Stela App

## Input Validation
- [ ] All API inputs validated with Zod schemas
- [ ] No dynamic SQL — prepared statements with `?` only
- [ ] Column allowlists prevent SQL injection
- [ ] Rate limiting enforced (60/min read, 10/min write per IP)
- [ ] Address-based rate limit (10/min per StarkNet address for writes)

## Signatures & Authentication
- [ ] SNIP-12 typed data verification on server (reconstruct + verify)
- [ ] On-chain nonce verification prevents replay attacks
- [ ] Timing-safe Bearer token comparison for webhooks
- [ ] No server-side user accounts — wallet-based auth only

## Secrets
- [ ] Never stored in D1
- [ ] Never committed to git
- [ ] Only via `wrangler secret put`
- [ ] Used only in bot/indexer workers (BOT_PRIVATE_KEY, RPC_URL)

## Frontend
- [ ] No hardcoded private keys or secrets
- [ ] No eval() or dynamic code execution
- [ ] No dangerouslySetInnerHTML
- [ ] BigInt/u256 values rendered as strings (never Number())
