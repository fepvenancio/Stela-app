# Stela UI Redesign — Design Specification

**Date:** 2026-03-24
**Goal:** Reskin stela-app with the new stela-protocol design language. Keep all business logic, hooks, API routes, and blockchain integration intact. Change only the visual layer.

**Guiding principle:** Make it as simple as possible for users.

---

## 1. Design Tokens

### Colors

Replace the entire stela-app color system. Remove gold theme, starfield, granite noise.

```
Background:     #050505  (page bg, replaces void #0a0a0e)
Surface:        #0A0A0A  (cards, sidebar, header)
Surface Hover:  #111111  (hover states)
Border:         rgba(255, 255, 255, 0.06)  (replaces solid edge #2a2a2e)
Accent:         #3B82F6  (primary blue, replaces gold #e8a825)

Green:          #22c55e  (success, positive APY)
Orange:         #f97316  (warning, borrow APY)
Red:            #ef4444  (danger, liquidation)
Purple:         #a855f7  (stela inscriptions accent)

Text White:     #ffffff  (primary content)
Text Gray 300:  #d1d5db  (secondary)
Text Gray 400:  #9ca3af  (tertiary)
Text Gray 500:  #6b7280  (muted labels)
Text Gray 600:  #4b5563  (disabled/hints)
Text Gray 700:  #374151  (placeholders)
```

### Typography

**Fonts:**
- Sans: Inter (weights: 300, 400, 500, 600, 700)
- Mono: JetBrains Mono (weights: 400, 500, 600)
- Remove: Cinzel (display), IBM Plex Mono

**Scale:**
| Role | Size | Weight | Extra |
|------|------|--------|-------|
| Page heading | text-5xl (48px) | bold (700) | tracking-tighter |
| Section title | text-4xl (36px) | bold | tracking-tight |
| Card title | text-2xl (24px) | bold | tracking-tight |
| Stat value | text-3xl (30px) | bold | tracking-tight, font-mono |
| Body | text-base (16px) | medium (500) | — |
| Small body | text-sm (14px) | medium | — |
| Micro label | text-[10px] | bold (700) | uppercase, tracking-[0.15em] |
| APY/amounts | text-lg (18px) | bold | font-mono |

**Reusable class:**
```css
.text-micro {
  @apply text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500;
}
```

### Spacing

Spacious feel — larger padding than current app.

| Context | Value |
|---------|-------|
| Card padding | p-8 (32px) to p-10 (40px) |
| Modal padding | p-12 (48px) |
| Section gaps | space-y-10 (40px) |
| Form groups | space-y-4 to space-y-6 |
| Flex gaps | gap-4 (16px) most common |
| Grid gaps | gap-8 (32px) |
| Page wrapper | p-10 max-w-7xl mx-auto |

### Border Radius

Much rounder than current app.

| Element | Radius |
|---------|--------|
| Inputs, small buttons | rounded-xl (12px) |
| Cards, interactive | rounded-2xl (16px) |
| Stat cards | rounded-[2rem] (32px) |
| Content sections | rounded-[2.5rem] (40px) |
| Modals | rounded-[3rem] (48px) |
| Badges, pills | rounded-full |

### Shadows

Dark-mode depth via colored shadows:

```
Default card:  shadow-2xl shadow-black/20
Accent glow:   shadow-2xl shadow-accent/20
Button:        shadow-xl shadow-white/5
Glow effect:   absolute bg-accent/5 blur-[60px]  (positioned behind cards)
```

---

## 2. Layout Architecture

### Replace: Top Nav → Collapsible Sidebar + Sticky Header

**Sidebar (left, sticky, full height):**
- Width: 280px expanded, 80px collapsed (animated with Motion)
- Background: surface (#0A0A0A)
- Border-right: border (white/6%)
- Logo at top (Stela icon + text, hidden when collapsed)
- Nav items with Lucide icons + labels
- Toggle button to collapse/expand
- `sticky top-0 h-screen z-50`
- **State persistence:** Collapsed/expanded state saved to `localStorage` key `stela-sidebar-open`. Defaults to expanded on desktop, collapsed on tablet.

**Sidebar Nav Items (Lucide icons):**
| Tab | Icon | Lucide Name |
|-----|------|-------------|
| Dashboard | LayoutDashboard | `layout-dashboard` |
| Lend | HandCoins | `hand-coins` |
| Borrow | FileSignature | `file-signature` |
| Swap | ArrowLeftRight | `arrow-left-right` |
| Stelas | Layers | `layers` |
| Portfolio | Briefcase | `briefcase` |
| NFT | Gem | `gem` |
| Faucet | Droplets | `droplets` |

**Active state:** `bg-accent/10 border border-accent/40 text-accent` with Motion `layoutId` animated indicator.

**Inactive state:** `text-gray-600 hover:text-white hover:bg-white/[0.02]`

**Header (sticky, top, right of sidebar):**
- Height: h-20 (80px)
- Background: surface (#0A0A0A)
- Border-bottom: border (white/6%)
- Left: Global search input (max-w-xl)
- Right: Network status indicator + Connect Wallet button (white bg, black text)
- `sticky top-0 z-40`

**Main Content:**
- Right of sidebar, below header
- `p-10 max-w-7xl mx-auto w-full`
- Content fills remaining space

### Mobile Responsive
- Sidebar collapses to icon-only (80px) at `lg` breakpoint
- Below `lg`: sidebar hidden, replaced by hamburger menu → Sheet (existing pattern)
- Header adapts: search hidden on mobile, hamburger + wallet button only

---

## 3. Pages

### 3.1 Dashboard (replaces /trade)

The main landing page. Shows portfolio overview and market opportunities.

**Stat Cards Row:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8`
- Net Worth (accent glow)
- Total Lent (green)
- Total Borrowed (orange)
- Health Factor (purple)

Each stat card:
```
bg-surface border-border rounded-[2rem] p-8
├── Absolute glow: bg-{color}/5 blur-[60px]
├── Label: .text-micro
├── Icon: p-2.5 rounded-xl bg-{color}/10 text-{color}
├── Value: text-3xl font-bold font-mono tracking-tight
└── Trend: TrendingUp icon + green text
```

**Data sources for stat cards:**
- Net Worth: Computed client-side from `useTokenBalances` + `usePortfolio` (sum of lent + available balances)
- Total Lent: From `usePortfolio` hook (sum of active lending positions)
- Total Borrowed: From `usePortfolio` hook (sum of active borrowing positions)
- Health Factor: Computed client-side (collateral value / debt value ratio from active positions). Shows "∞" if no borrows.
- Trend arrows: Static UI only (no historical data). Shows neutral "—" until historical tracking is implemented.

**Two-column layout below:** `grid grid-cols-1 lg:grid-cols-3 gap-10`
- Left (col-span-2): Active Positions card
- Right (col-span-1): Your Assets sidebar

**Market Opportunities Table:** Below, full width
- Grid: `grid-cols-5 gap-8 p-8`
- Columns: Symbol, Total Lent, Lend APY, Borrow APY, Utilization (progress bar with glow)
- Hover rows

### 3.2 Lend

Multi-asset basket builder for creating lend offers.
- Interest rate selector
- Collateral picker
- Preview with fee breakdown
- Confirm button → review modal

### 3.3 Borrow

**Multi-step inscribe wizard (4 steps):**
1. Select assets (debt + interest)
2. Set collateral
3. Set duration + terms
4. Review + sign

Progress indicator at top. Back/Continue navigation. Success screen with animated checkmark on completion.

**Note:** The existing `/borrow/components/` directory contains form components that will be replaced by the wizard steps. The wizard wraps the same business logic (useCreateInscription, useSignOrder hooks) but restructures the UI into discrete steps.

### 3.4 Swap

Mode toggle: "tokens" vs "stelas"
- Input/output token selectors
- Amount input with MAX button
- Fee preview
- Swap button

### 3.5 Stelas (replaces /markets)

Grid of inscription cards with search/filter.
- Search bar at top
- Filter by status, asset type
- Card grid: inscription summary + APY + status
- Click → Stela Details Modal (not page navigation)

**Stela Details Modal:**
```
Overlay: fixed inset-0 bg-black/80 backdrop-blur-xl
Modal: max-w-2xl rounded-[3rem] border-border p-12
├── Header: inscription ID + status badge
├── Details grid: 2-col with key-value pairs
├── Assets list: debt, interest, collateral
└── Action buttons: Lend, Repay, Liquidate, Redeem
```

### 3.6 Portfolio (restyled)

Keep existing functionality. Restyle with:
- Stat cards at top (total lent, borrowed, earned)
- Tabbed view: Active | Pending | History
- Position rows with new styling
- Action buttons per position

### 3.7 NFT (restyled)

Keep existing mint + claim pages. Restyle with new design tokens.

### 3.8 Faucet

Info section + link to StarkNet faucet. Minimal page with new styling.

### 3.9 Other Pages (restyled only)

These existing pages are not in the new design prototype but must be restyled with new tokens:

| Route | Treatment |
|-------|-----------|
| `/stela/[id]` | Keep as standalone detail page for direct links/sharing. Also accessible via StelaDetailsModal from the Stelas grid. Both render the same data, just different containers. |
| `/docs` | Restyle with new typography and colors |
| `/faq` | Restyle with new typography and colors |
| `/terms` | Restyle with new typography and colors |
| `/privacy` | Restyle with new typography and colors |

---

## 4. Components

### 4.1 New Components to Build

| Component | Description |
|-----------|-------------|
| `Sidebar` | Collapsible nav with Motion animation, Lucide icons, active indicator |
| `SidebarNavItem` | Single nav item (icon + label + active state) |
| `StatCard` | Dashboard stat with glow, icon, value, trend |
| `GlobalSearch` | Header search input — placeholder UI only in Phase 1. Shows `Cmd+K` hint, opens empty search overlay. Functional search (querying inscriptions/orders via API) deferred to Phase 2. |
| `StelaDetailsModal` | Rich inscription detail modal (replaces page nav) |
| `InscribeWizard` | 4-step borrow creation flow with progress |
| `WizardStep` | Single step container with navigation |
| `SuccessScreen` | Animated checkmark with breathing circles |
| `MarketRow` | Market opportunity row with utilization bar |
| `PositionRow` | Active position display row |
| `AssetRow` | "Your Assets" sidebar row |
| `UtilizationBar` | Progress bar with color glow |

### 4.2 Components to Restyle

All existing shadcn/ui components need token updates:

| Component | Changes |
|-----------|---------|
| `Button` | New variants: primary (white bg, black text), secondary (surface), tertiary (white/5), ghost. Remove gold/aurora/nova/cosmic variants. |
| `Card` | Increase border-radius to rounded-2xl or rounded-[2rem]. Update bg to surface, border to white/6%. |
| `Dialog` | Increase border-radius to rounded-[3rem]. Add backdrop-blur-xl. Update padding to p-12. |
| `Input` | Use .input-base class: bg-white/[0.02], border white/6%, focus:border-accent/50. |
| `Badge` | Update colors to new palette. |
| `Tabs` | Restyle to match new design tab appearance. |
| `Sheet` | Update for mobile nav with new colors. |
| `Skeleton` | Update bg to white/[0.02]. |
| `Select` | Restyle dropdowns with new surface/border. |
| `Footer` | Restyle with new colors, keep socials links |
| `WalletButton` | Restyle: white bg, black text (primary CTA style) |
| `NetworkMismatchBanner` | Restyle with new red/warning tokens |
| `TermsGate` | Restyle modal with new dialog styling |
| `PageHeader` | Replace `font-display` with `font-sans font-bold`, update colors |

**Font migration:** Replace ALL `font-display` class references (Cinzel) with `font-sans font-bold` or remove where purely decorative. Global find-replace needed across components.

### 4.3 Button Variants (new)

| Variant | Style | Usage |
|---------|-------|-------|
| primary | `bg-white text-black font-bold text-xs uppercase tracking-[0.15em] rounded-xl shadow-xl shadow-white/5 hover:bg-gray-200` | Main CTAs (rounded-xl intentionally — compact, punchy) |
| secondary | `bg-surface border-border rounded-2xl text-gray-600 hover:text-white hover:bg-white/[0.02]` | Secondary actions |
| tertiary | `bg-white/5 text-white rounded-2xl border-white/5 hover:bg-white/10` | Tertiary (back, cancel) |
| ghost | `p-3 rounded-2xl text-gray-600 hover:bg-white/5` | Icon buttons, close |
| toggle-active | `bg-accent/10 border-accent/40 text-accent` | Active toggle |
| toggle-inactive | `bg-white/[0.02] border-border opacity-50` | Inactive toggle |

---

## 5. Animations

### Add Motion library (motion/react)

**Sidebar collapse/expand:**
```tsx
animate={{ width: isOpen ? 280 : 80 }}
transition={{ duration: 0.3, ease: "easeInOut" }}
```

**Modal enter/exit:**
```tsx
initial={{ opacity: 0, scale: 0.9, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.9, y: 20 }}
```

**Tab content transitions:**
```tsx
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -10 }}
```

**Active nav indicator:**
```tsx
<motion.div layoutId="active-nav" />
```

**Success screen:**
- Pulsing circles with breathing animation
- Scale keyframes: `[1, 1.2, 1]`

### Remove
- Starfield CSS (drift animation, radial gradients)
- Granite noise texture overlay
- Stela pattern/border CSS classes

---

## 6. CSS Changes (globals.css)

### Replace @theme block entirely:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-surface: #0A0A0A;
  --color-surface-hover: #111111;
  --color-border: rgba(255, 255, 255, 0.06);
  --color-accent: #3B82F6;
}
```

### Add component layer:

```css
@layer components {
  .text-micro {
    @apply text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500;
  }
  .glass-card {
    @apply bg-surface border border-border rounded-2xl transition-all duration-300;
  }
  .input-base {
    @apply bg-white/[0.02] border border-border rounded-xl px-4 py-3 outline-none focus:border-accent/50 transition-all text-sm placeholder:text-gray-700;
  }
}
```

### Update shadcn/ui CSS variable bridge:

Map new tokens to shadcn variables (--background → #050505, --primary → accent, --border → white/6%, etc.)

### Remove:
- Starfield CSS (.starfield, ::before, ::after, drift keyframe)
- Granite noise (.granite-noise)
- Stela pattern (.stela-pattern, .stela-border)
- Gold-colored gradients on body
- Cinzel font import
- IBM Plex Mono font import

---

## 7. Files to Change

### High Priority (core reskin):
1. `globals.css` — Complete theme replacement
2. `layout.tsx` — Font imports (drop Cinzel, IBM Plex Mono; add JetBrains Mono), remove starfield div
3. `AppShell.tsx` — Replace top nav with sidebar + sticky header layout
4. `ui/button.tsx` — New variant definitions
5. `ui/card.tsx` — Updated border-radius, padding, colors
6. `ui/dialog.tsx` — Larger radius, blur backdrop, more padding
7. `ui/input.tsx` — Use .input-base pattern
### New Components:
9. `components/Sidebar.tsx` — Collapsible sidebar navigation
10. `components/SidebarNavItem.tsx` — Individual nav item
11. `components/StatCard.tsx` — Dashboard stat card with glow
12. `components/GlobalSearch.tsx` — Header search
13. `components/StelaDetailsModal.tsx` — Rich inscription detail modal
14. `components/InscribeWizard.tsx` — 4-step borrow flow
15. `components/SuccessScreen.tsx` — Animated success
16. `components/MarketRow.tsx` — Market table row
17. `components/UtilizationBar.tsx` — Progress bar with glow

### Pages to Restyle:
18. `trade/page.tsx` → Rename to `dashboard/page.tsx` — Complete rebuild as dashboard
19. `borrow/page.tsx` — Integrate InscribeWizard
20. `swap/page.tsx` — Restyle with new tokens
21. `markets/page.tsx` → Rename to `stelas/page.tsx` — Grid + modal pattern
22. `portfolio/page.tsx` — Restyle with stat cards + new component styling
23. `nft/page.tsx` + `nft/claim/page.tsx` — Restyle
24. `faucet/page.tsx` — Restyle

### Update Existing Components (restyle):
25-40+. All domain components (FeeBreakdown, OrderBook, AssetInput, PortfolioRows, etc.) — update Tailwind classes to new tokens.

### Dependencies:
- Add: `motion` v11+ (imports from `motion/react`, the successor to `framer-motion`)
- Add: JetBrains Mono via Google Fonts import in `layout.tsx`
- Keep: Lucide React, Radix UI, shadcn/ui, all blockchain deps
- Remove: Cinzel font, IBM Plex Mono font

### Floating UI Elements:
- **Remove** `HelpButton` (bottom-left FAB) — simplify the UI
- **Keep** `ScrollToTopButton` (bottom-right) — restyle with new colors

---

## 8. What NOT to Change

- All API routes (`/api/*`) — untouched
- All hooks (`/hooks/*`) — untouched (logic stays, only imported components change)
- All lib utilities (`/lib/*`) — untouched
- Zustand stores — untouched
- `@stela/core` package — untouched
- `workers/*` and `services/*` — untouched
- StarkNet integration — untouched
- Off-chain signing flows — untouched
- Next.js App Router structure — routes may rename but architecture stays

---

## 9. Redirects & Route Changes

**Remove existing redirect:** `/stelas` → `/markets` (currently in next.config.ts — now reversed).

**Add new redirects:**

| Old Route | New Route |
|-----------|-----------|
| `/trade` | `/dashboard` |
| `/markets` | `/stelas` |
| `/markets/[pair]` | `/stelas` (pairs browsed via modal now) |

**Root route (`/`):** Redirects to `/dashboard` (update existing redirect from `/trade`).

**Keep existing redirects:** `/order/:id` → `/stela/:id`, `/inscription/:id` → `/stela/:id`, `/inscribe` → `/borrow`, `/genesis` → `/nft`, `/genesis/claim` → `/nft/claim`.

---

## 10. Accessibility

- **Reduced motion:** All Motion animations must respect `prefers-reduced-motion`. Wrap animations with `useReducedMotion()` from `motion/react` — fall back to instant state changes (no spring/transition).
- **Focus management:** Sidebar nav items support keyboard navigation (arrow keys). Mobile sheet traps focus when open. `aria-current="page"` on active nav item.
- **Color contrast:** Text gray-600 (#4b5563) on background (#050505) is ~2.5:1 — use ONLY for decorative/non-essential text (hints, disabled). All readable text must use gray-500 (#6b7280) or lighter, which achieves ~3.5:1+ on dark backgrounds.
- **Route announcements:** Use Next.js built-in route change announcements (automatic with App Router).

---

## 11. Success Criteria

1. Every page matches the new stela-protocol design language
2. All business logic preserved — no regressions in signing, settling, portfolio
3. Sidebar navigation works on desktop (collapsible) and mobile (sheet)
4. Dashboard shows real data via existing hooks
5. Stela details open in modal (not page navigation)
6. Smooth Motion animations on sidebar, modals, tab transitions
7. All components use new color tokens — zero gold references remain
8. Responsive: works on mobile, tablet, desktop
9. Build passes (`pnpm build`)
10. Deploy succeeds to Cloudflare Workers
