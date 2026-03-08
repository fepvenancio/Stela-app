# Stela Frontend UX Overhaul Plan

## Goal
Reduce click count, simplify terminology, surface key metrics, maintain all functionality.

## Phase 1 (Parallel — No Dependencies)

### Change 3: Navigation Rename
- `/stelas` → `/markets`, label "Markets"
- `/inscribe` → `/borrow`, label "Borrow"
- `/genesis` → `/nft`, label "NFT"
- Rename filesystem directories, add redirects in next.config.ts
- Update 12+ files with route references

### Change 5: Home Page Improvements
- Hero: "P2P Lending & Swaps on StarkNet" + "First P2P lending on StarkNet"
- Add "Why P2P?" comparison table section (vs pool-based)
- Add trust signals strip (audit, open source, immutable, StarkNet)
- Multi-asset collateral callout (ERC20/721/1155/4626)
- Mention swaps in hero
- Update CTA links to new routes

### Change 6: Docs Page
- Reorder: "What is Stela?" first, governance later
- Add Quick Start guide (3 steps)
- Add swap documentation (duration=0)
- Fix stale fee note (redeem discount mention)
- Add risks section

## Phase 2 (After Phase 1)

### Change 2: Markets Page (Browse)
- Remove source filter (on-chain/off-chain toggle)
- Add APY/yield column to listing rows (use computeYieldPercent)
- Add confirmation popover before single-item "Lend" action
- Keep sorting, search, batch selection unchanged

### Change 4: Portfolio Consolidation
- 6 tabs → 3: Active, Pending, History
- Active = Lending + Borrowing + filled Orders
- Pending = open Orders + open Swaps
- History = Repaid + Redeemable + expired/cancelled
- Redeemable notification badge on History tab

## Phase 3 (Last — Most Complex)

### Change 1: Inscribe/Borrow Page Inline Form
- Loan: "I want to borrow [Token][Amount]" + "I'll put up [Token][Amount]" + "I'll pay interest [Token][Amount]"
- Swap: "I give [Token][Amount]" + "I receive [Token][Amount]"
- Move on-chain/off-chain + multi-lender to Advanced section
- Keep AddAssetModal for power users (multi-asset)
- New component: InlineBorrowForm.tsx
- All submission logic unchanged

## New Components
- `InlineBorrowForm` — inline token+amount rows
- `LendConfirmPopover` — confirmation before single lend

## Component Reuse
- TokenSelectorModal → reused in inline form
- AssetRow → unchanged in advanced section
- AddAssetModal → add defaultRole prop
- computeYieldPercent → display in listing rows
- CompactAssetSummary → unchanged
