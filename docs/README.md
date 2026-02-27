# Stela Documentation

Stela frontend, indexer, and bot -- a P2P lending protocol on StarkNet.

This monorepo contains the full application stack for the Stela protocol: a Next.js frontend deployed on Cloudflare Workers, an Apibara-based event indexer, a webhook receiver worker, and an automated liquidation/settlement bot.

## Documentation Index

| Document | Description |
|---|---|
| [architecture.md](./architecture.md) | System architecture, monorepo structure, data flow, and Cloudflare stack |
| [frontend.md](./frontend.md) | Frontend pages, components, hooks, state management, and wallet integration |
| [deployment.md](./deployment.md) | Deployment guide, prerequisites, environment setup, and secret management |

## Quick Reference

- **Live domain:** `stela-dapp.xyz`
- **Network:** StarkNet Sepolia (testnet)
- **Contract:** `0x021e81956fccd8463342ff7e774bf6616b40e242fe0ea09a6f38735a604ea0e0`
- **Package manager:** pnpm 10.28.0
- **Build system:** Turborepo
- **Runtime:** Cloudflare Workers (workerd)
- **Database:** Cloudflare D1 (SQLite)

## Source Repositories

| Repository | Purpose |
|---|---|
| [fepvenancio/Stela](https://github.com/fepvenancio/Stela) | Cairo smart contracts |
| [fepvenancio/stela-app](https://github.com/fepvenancio/stela-app) | This repo -- frontend, indexer, bot |
| [fepvenancio/stela-sdk-ts](https://github.com/fepvenancio/stela-sdk-ts) | TypeScript SDK (`@fepvenancio/stela-sdk`) |
