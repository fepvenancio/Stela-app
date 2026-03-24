# Stela UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin stela-app from gold/top-nav theme to blue/sidebar theme matching the stela-protocol prototype, preserving all business logic.

**Architecture:** Replace design tokens (globals.css), restructure layout (sidebar + sticky header), restyle all shadcn/ui components, add new dashboard/stat components, add Motion animations. No changes to API routes, hooks, libs, or blockchain integration.

**Tech Stack:** Next.js 15, Tailwind CSS 4, Motion v11+ (motion/react), Lucide React, Radix UI, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-24-ui-redesign-design.md`
**Prototype reference:** `~/Downloads/stela-protocol/src/App.tsx`

---

## File Map

### New Files
- `src/components/Sidebar.tsx` — Collapsible left navigation
- `src/components/SidebarNavItem.tsx` — Individual nav item with Motion indicator
- `src/components/GlobalSearch.tsx` — Header search input (placeholder Phase 1)
- `src/components/StatCard.tsx` — Dashboard stat card with glow
- `src/components/MarketRow.tsx` — Market opportunities table row
- `src/components/UtilizationBar.tsx` — Progress bar with glow effect
- `src/components/StelaDetailsModal.tsx` — Rich inscription detail modal
- `src/components/SuccessScreen.tsx` — Animated success checkmark
- `src/app/dashboard/page.tsx` — New dashboard page (replaces /trade)

### Modified Files (core)
- `src/app/globals.css` — Complete theme replacement
- `src/app/layout.tsx` — Font swap, remove starfield
- `src/components/AppShell.tsx` — Full rewrite: sidebar + header layout
- `src/components/ui/button.tsx` — New variant system
- `src/components/ui/card.tsx` — Updated radius, borders, padding
- `src/components/ui/dialog.tsx` — Larger radius, blur backdrop
- `src/components/ui/input.tsx` — New .input-base styling
- `src/components/ui/badge.tsx` — New color tokens
- `src/components/ui/sheet.tsx` — Updated for mobile nav
- `src/components/ui/skeleton.tsx` — Updated bg color
- `src/components/ui/select.tsx` — Replace abyss/edge/star/chalk/dust tokens
- `src/components/ui/toggle.tsx` — Replace star/dust/chalk/edge tokens
- `src/components/ui/toggle-group.tsx` — Replace old tokens
- `src/components/ui/tooltip.tsx` — Replace elevated/chalk/edge-bright tokens
- `src/components/ui/tabs.tsx` — Restyle tab indicators
- `src/components/ui/sonner.tsx` — Update toast colors
- `src/components/ui/label.tsx` — Update text color
- `src/components/ui/separator.tsx` — Update border color
- `src/components/ui/switch.tsx` — Replace old tokens
- `src/components/Footer.tsx` — Restyle with new tokens
- `src/components/WalletButton.tsx` — White CTA style, new colors
- `src/components/PageHeader.tsx` — Drop font-display, new sizing
- `apps/web/next.config.ts` — Updated redirects
- `apps/web/package.json` — Add motion dependency

### Modified Files (pages — restyle)
- `src/app/page.tsx` — Redirect to /dashboard
- `src/app/trade/page.tsx` — Redirect or remove (replaced by dashboard)
- `src/app/borrow/page.tsx` — Restyle with new tokens
- `src/app/borrow/components/*.tsx` — Restyle InlineBorrowForm, AddAssetModal, AssetRow (3 files)
- `src/app/swap/page.tsx` — Restyle with new tokens
- `src/app/markets/page.tsx` — Restyle as stelas grid
- `src/app/markets/[pair]/page.tsx` — Restyle or redirect
- `src/app/markets/components/FilterSection.tsx` — Restyle
- `src/app/portfolio/page.tsx` — Restyle with stat cards
- `src/app/nft/page.tsx` — Restyle
- `src/app/nft/claim/page.tsx` — Restyle
- `src/app/faucet/page.tsx` — Restyle
- `src/app/stela/[id]/page.tsx` — Restyle detail page
- `src/app/inscription/[id]/page.tsx` — Restyle (still exists even with redirect)
- `src/app/order/[id]/page.tsx` — Restyle (still exists even with redirect)
- `src/app/docs/page.tsx` — Restyle
- `src/app/faq/page.tsx` — Restyle
- `src/app/terms/page.tsx` — Restyle
- `src/app/privacy/page.tsx` — Restyle

### Modified Files (components — restyle)
- All 12 files in `src/components/orderbook/` — New color tokens
- All 5 files in `src/components/portfolio/` — New color tokens
- All 8 files in `src/components/trade/` — New color tokens
- All remaining ~30 domain components in `src/components/` — Replace gold/star/edge/void/chalk/dust/ash references
- Specifically includes: InscriptionListRow, OrderListRow, MatchListRow, ListingTableHeader, PairCard, PoolPairDisplay, BrowseControls, LoadMore, SelectionActionBar, InlineMatchList, ShareListingsSection, InterestAccrualDisplay, AuctionTimer, CopyButton, CompactAssetSummary, Web3ActionWrapper, InfoTooltip, AddressDisplay, TokenAvatar, RefinanceOfferForm, PositionValueDisplay

### Token Replacement Reference

Use this mapping for ALL restyle tasks (Tasks 7-8):

| Old Token | New Token |
|-----------|-----------|
| `text-star` | `text-accent` |
| `text-star-bright` | `text-accent/80` |
| `text-star-dim` | `text-accent/50` |
| `text-chalk` | `text-white` |
| `text-dust` | `text-gray-400` |
| `text-ash` | `text-gray-500` |
| `bg-void` | `bg-[#050505]` |
| `bg-abyss` | `bg-surface` |
| `bg-elevated` | `bg-surface-hover` |
| `bg-star` | `bg-accent` |
| `bg-nova` | `bg-red-500` |
| `bg-aurora` | `bg-green-500` |
| `bg-cosmic` | `bg-sky-500` |
| `bg-ember` | `bg-orange-500` |
| `border-edge` | `border-border` |
| `border-edge-bright` | `border-white/20` |
| `text-star/X` | `text-accent/X` |
| `bg-star/X` | `bg-accent/X` |
| `ring-star` | `ring-accent` |
| `font-display` | `font-sans font-bold` |
| `variant="gold"` | `variant="default"` |
| `variant="aurora"` | (use custom `bg-green-500 text-white`) |
| `variant="nova"` | `variant="destructive"` |
| `variant="cosmic"` | (use custom `bg-sky-500 text-white`) |
| `hover:text-star-bright` | `hover:text-accent/80` |
| `hover:border-star` | `hover:border-accent` |
| `color-star` | `color-accent` |
| `color-void` | `#050505` |
| `color-abyss` | `color-surface` |
| `color-elevated` | `color-surface-hover` |
| `color-edge` | `color-border` |
| `color-chalk` | `#ffffff` |
| `color-dust` | `#9ca3af` |
| `color-ash` | `#6b7280` |

---

## Task 1: Install Dependencies & Update Fonts

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Install motion library**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web add motion
```

- [ ] **Step 2: Update layout.tsx fonts**

Replace font imports in `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'
import { TermsGate } from '@/components/TermsGate'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' })
```

Update body classes — remove `cinzel.variable`, `ibmMono.variable`, starfield div, replace color classes:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#050505] text-white antialiased`}
      >
        <Providers>
          <TooltipProvider>
            <AppShell>
              <ErrorBoundary>{children}</ErrorBoundary>
            </AppShell>
            <TermsGate />
            <Toaster richColors />
          </TooltipProvider>
        </Providers>
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  )
}
```

Note: Starfield `<div>` removed. Cinzel and IBM Plex Mono removed.

- [ ] **Step 3: Verify build compiles**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

Expected: Build succeeds (may have lint warnings about unused old color tokens — that's fine).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/app/layout.tsx pnpm-lock.yaml
git commit -m "feat: swap fonts to Inter + JetBrains Mono, add motion, remove starfield"
```

---

## Task 2: Replace globals.css Theme

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace globals.css entirely**

Replace the full file with new design tokens. The new file must:
- Replace `@theme` block with new color tokens (surface, border, accent as #3B82F6)
- Replace `--font-sans` to use `--font-inter`, `--font-mono` to use `--font-jetbrains`
- Update shadcn/ui CSS variable bridge (--background → #050505, --primary → accent, etc.)
- Add `.text-micro`, `.glass-card`, `.input-base` component classes
- Add `fade-up`, `fade-in` keyframes (keep from current)
- Remove: starfield, granite-noise, stela-pattern, stela-border, gold body gradients, stela-focus
- Keep: scrollbar styling (update colors), focus states (update to accent), form element styles, mobile text readability

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;

  --color-surface: #0A0A0A;
  --color-surface-hover: #111111;
  --color-border: rgba(255, 255, 255, 0.06);
  --color-accent: #3B82F6;

  --animate-fade-up: fade-up 0.15s ease-out both;
  --animate-fade-in: fade-in 0.15s ease-out both;
}

/* Keyframes */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* shadcn/ui CSS Variable Bridge */
@layer base {
  :root {
    --background: #050505;
    --foreground: #ffffff;
    --card: var(--color-surface);
    --card-foreground: #ffffff;
    --popover: var(--color-surface);
    --popover-foreground: #ffffff;
    --primary: var(--color-accent);
    --primary-foreground: #ffffff;
    --secondary: var(--color-surface);
    --secondary-foreground: #d1d5db;
    --muted: #111111;
    --muted-foreground: #6b7280;
    --accent: #111111;
    --accent-foreground: #ffffff;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    --border: var(--color-border);
    --input: var(--color-border);
    --ring: var(--color-accent);
    --radius: 0.75rem;
    --sidebar: var(--color-surface);
    --sidebar-foreground: #ffffff;
    --sidebar-primary: var(--color-accent);
    --sidebar-primary-foreground: #ffffff;
    --sidebar-accent: #111111;
    --sidebar-accent-foreground: #ffffff;
    --sidebar-border: var(--color-border);
    --sidebar-ring: var(--color-accent);
  }
}

/* Base */
html { scroll-behavior: smooth; color-scheme: dark; }

body {
  background: #050505;
  min-height: 100dvh;
}

::selection {
  background: rgba(59, 130, 246, 0.22);
  color: #ffffff;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

/* Focus States */
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
  transition: border-color 0.15s, box-shadow 0.15s;
}

/* Form Elements */
select option {
  background: var(--color-surface);
  color: #ffffff;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  opacity: 0.3;
}

/* Mobile Text Readability */
@media (max-width: 640px) {
  input, select, textarea {
    font-size: 16px !important;
  }
}

/* Component Layer */
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

- [ ] **Step 2: Verify no build errors**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

Expected: Build passes. Pages will look broken (expected — components still reference old tokens).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: replace theme with blue accent design tokens"
```

---

## Task 3: Restyle shadcn/ui Base Components

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/dialog.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/skeleton.tsx`
- Modify: `apps/web/src/components/ui/sheet.tsx`

- [ ] **Step 1: Replace button variants**

In `button.tsx`, replace the `variants` object:

```tsx
variant: {
  default: "bg-white text-black hover:bg-gray-200 font-bold text-xs uppercase tracking-[0.15em] shadow-xl shadow-white/5",
  destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500/20",
  outline: "border border-border bg-transparent text-gray-400 hover:text-white hover:border-white/20",
  secondary: "bg-surface border border-border text-gray-400 hover:text-white hover:bg-white/[0.02]",
  ghost: "text-gray-500 hover:bg-white/5 hover:text-white",
  link: "text-accent underline-offset-4 hover:underline",
  accent: "bg-accent text-white hover:bg-accent/80 shadow-xl shadow-accent/20",
},
```

Remove: `gold`, `aurora`, `nova`, `cosmic` variants.

Update sizes — increase border-radius:

```tsx
size: {
  default: "h-10 sm:h-9 px-4 py-2 rounded-xl has-[>svg]:px-3",
  xs: "h-8 sm:h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-10 sm:h-8 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
  lg: "h-11 sm:h-10 rounded-xl px-6 has-[>svg]:px-4",
  xl: "h-12 rounded-2xl px-8 text-sm font-bold",
  icon: "size-10 sm:size-9 rounded-xl",
  "icon-xs": "size-8 sm:size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-10 sm:size-8 rounded-xl",
  "icon-lg": "size-11 sm:size-10 rounded-xl",
},
```

- [ ] **Step 2: Update Card component**

In `card.tsx`, update `Card` base classes:

```tsx
"bg-surface text-white flex flex-col gap-6 rounded-2xl border border-border py-6 shadow-2xl shadow-black/20",
```

Update `CardTitle`:
```tsx
"leading-none font-bold text-white",
```

Update `CardDescription`:
```tsx
"text-gray-500 text-sm",
```

- [ ] **Step 3: Update Dialog**

In `dialog.tsx`, update `DialogContent` classes — find the content wrapper and update:
- Border radius: `rounded-[3rem]` (from `rounded-lg`)
- Background: `bg-surface`
- Border: `border border-border`
- Add: `backdrop-blur-xl` to overlay
- Padding: increase to `p-12`
- Shadow: `shadow-[0_0_100px_rgba(0,0,0,0.5)]`

- [ ] **Step 4: Update Input**

In `input.tsx`, update base classes to match `.input-base`:

```tsx
"flex h-10 w-full rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-white transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-700 focus-visible:outline-none focus-visible:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
```

- [ ] **Step 5: Update Badge, Skeleton, Sheet**

Badge: Replace color references from star/nova/aurora to accent/red/green.

Skeleton: Update `bg-muted` to `bg-white/[0.02] animate-pulse`.

Sheet: Update background from `bg-void/95` to `bg-surface/95`.

- [ ] **Step 6: Update remaining UI components (select, toggle, tooltip, tabs, sonner, switch, label, separator)**

In `select.tsx`: Replace `bg-abyss` → `bg-surface`, `border-edge` → `border-border`, `text-chalk` → `text-white`, `text-dust` → `text-gray-400`, `text-ash` → `text-gray-500`, `text-star` → `text-accent`, `font-display` → `font-sans font-bold`.

In `toggle.tsx`: Replace `bg-star` → `bg-accent`, `text-star` → `text-accent`, `text-dust` → `text-gray-400`, `text-chalk` → `text-white`, `border-edge` → `border-border`.

In `toggle-group.tsx`: Same token replacements as toggle.

In `tooltip.tsx`: Replace `bg-elevated` → `bg-surface-hover`, `text-chalk` → `text-white`, `border-edge-bright` → `border-white/20`.

In `tabs.tsx`: Replace old tokens, update active tab indicator to use accent color.

In `sonner.tsx`: Replace any old color tokens.

In `switch.tsx`, `label.tsx`, `separator.tsx`: Replace any old color tokens.

- [ ] **Step 7: Verify build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat: restyle shadcn/ui components with new design tokens"
```

---

## Task 4: Build Sidebar + Header (AppShell Rewrite)

**Files:**
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/components/SidebarNavItem.tsx`
- Create: `apps/web/src/components/GlobalSearch.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`
- Modify: `apps/web/src/components/Footer.tsx`
- Modify: `apps/web/src/components/PageHeader.tsx`

This is the largest single task — the core layout restructure.

- [ ] **Step 1: Create SidebarNavItem.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'

interface SidebarNavItemProps {
  href: string
  label: string
  icon: LucideIcon
  isOpen: boolean
}

export function SidebarNavItem({ href, label, icon: Icon, isOpen }: SidebarNavItemProps) {
  const pathname = usePathname()
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 group relative ${
        active
          ? 'bg-white/[0.03] text-white'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
      }`}
    >
      <Icon size={18} className={active ? 'text-accent' : 'text-gray-500 group-hover:text-gray-300'} />
      {isOpen && <span className="font-semibold text-xs uppercase tracking-[0.1em]">{label}</span>}
      {active && (
        <motion.div
          layoutId="active-nav"
          className="absolute left-0 w-1 h-6 bg-accent rounded-r-full"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Create Sidebar.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Menu, X, ShieldCheck } from 'lucide-react'
import { SidebarNavItem } from './SidebarNavItem'
import { NETWORK } from '@/lib/config'
import {
  LayoutDashboard,
  HandCoins,
  FileSignature,
  ArrowLeftRight,
  Layers,
  Briefcase,
  Gem,
  Droplets,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Lend', icon: HandCoins },
  { href: '/borrow', label: 'Borrow', icon: FileSignature },
  { href: '/swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/stelas', label: 'Stelas', icon: Layers },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/nft', label: 'NFT', icon: Gem },
  ...(NETWORK === 'sepolia' ? [{ href: '/faucet', label: 'Faucet', icon: Droplets }] : []),
]

export function Sidebar() {
  const prefersReduced = useReducedMotion()
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('stela-sidebar-open')
    return saved !== null ? saved === 'true' : true
  })

  useEffect(() => {
    localStorage.setItem('stela-sidebar-open', String(isOpen))
  }, [isOpen])

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 80 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
      className="bg-surface border-r border-border flex-col sticky top-0 h-screen z-50 hidden lg:flex"
    >
      <div className="p-10 flex items-center gap-4">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-2xl shadow-accent/20 shrink-0">
          <ShieldCheck className="text-white" size={22} />
        </div>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-xl tracking-tighter text-white"
          >
            STELA
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-6 mt-4 space-y-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} {...item} isOpen={isOpen} />
        ))}
      </nav>

      <div className="p-6 border-t border-border">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center p-3 rounded-xl text-gray-600 hover:bg-white/5 transition-colors"
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </motion.aside>
  )
}
```

- [ ] **Step 3: Create GlobalSearch.tsx**

```tsx
'use client'

import { Search } from 'lucide-react'

export function GlobalSearch() {
  return (
    <div className="relative w-full max-w-xl group hidden lg:block">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent transition-colors" size={16} />
      <input
        type="text"
        placeholder="Search markets, assets, inscriptions..."
        className="w-full bg-white/[0.02] border border-border rounded-xl py-2.5 pl-12 pr-4 text-xs focus:border-accent/40 focus:bg-white/[0.04] transition-all outline-none text-white placeholder:text-gray-700"
        readOnly
        onFocus={(e) => e.target.blur()}
        title="Search coming soon"
      />
      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 bg-white/[0.02] px-1.5 py-0.5 rounded border border-border hidden sm:inline">
        ⌘K
      </kbd>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite AppShell.tsx**

Replace the entire file. The new AppShell:
- Has a flex row layout: Sidebar (left) + main column (right)
- The main column has: sticky header (wallet + search + network) + content + footer
- Mobile: sidebar hidden, hamburger opens Sheet from right
- Remove HelpButton (per spec)
- Keep ScrollToTopButton (restyle)

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { NetworkMismatchBanner } from './NetworkMismatchBanner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Footer } from '@/components/Footer'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { NETWORK } from '@/lib/config'
import {
  LayoutDashboard,
  HandCoins,
  FileSignature,
  ArrowLeftRight,
  Layers,
  Briefcase,
  Gem,
  Droplets,
  ChevronUp,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Lend', icon: HandCoins },
  { href: '/borrow', label: 'Borrow', icon: FileSignature },
  { href: '/swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/markets', label: 'Stelas', icon: Layers },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/nft', label: 'NFT', icon: Gem },
  ...(NETWORK === 'sepolia' ? [{ href: '/faucet', label: 'Faucet', icon: Droplets }] : []),
]

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-surface/80 border border-border flex items-center justify-center text-gray-500 hover:text-accent hover:border-accent/50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ChevronUp size={16} />
    </button>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header */}
        <header className="h-20 bg-surface/60 backdrop-blur-2xl border-b border-border px-4 sm:px-10 flex items-center justify-between sticky top-0 z-40">
          <NetworkMismatchBanner />

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-500 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </Button>

          <GlobalSearch />

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2 bg-white/[0.02] px-4 py-2 rounded-xl border border-border">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                StarkNet {NETWORK === 'sepolia' ? 'Sepolia' : 'Mainnet'}
              </span>
            </div>
            <WalletButton />
          </div>
        </header>

        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-72 bg-surface/95 border-border p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex flex-col h-full">
              <nav className="flex-1 px-3 pt-6 space-y-1" aria-label="Mobile navigation">
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.href)
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] uppercase tracking-[0.15em] font-semibold transition-all duration-200 ${
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-gray-500'}`} />
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="px-4 pb-6 pt-4">
                <WalletButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Page content */}
        <main className="relative z-10 flex-1 p-4 sm:p-10 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>

        <Footer />
      </div>

      <ScrollToTopButton />
    </div>
  )
}
```

- [ ] **Step 5: Update Footer.tsx**

Replace gold/star references with new tokens:
- Logo link: `text-accent hover:text-accent/80` (replaces `text-star hover:text-star-bright`)
- Nav links: `text-gray-500 hover:text-white` (replaces `text-dust hover:text-chalk`)
- Social icons: `text-gray-600 hover:text-white` (replaces `text-ash hover:text-chalk`)
- Border: `border-border` (replaces `border-edge/10`)
- Logo href: change from `/trade` to `/dashboard`

- [ ] **Step 6: Update PageHeader.tsx**

Replace `font-display` with `font-sans`:
- Title: `text-4xl sm:text-5xl font-bold tracking-tighter text-white` (was `font-display text-3xl sm:text-4xl`)
- Description: `text-gray-500 mt-3 font-medium text-sm` (was `text-dust`)
- CTA button: `variant="accent"` (was `variant="gold"`)

- [ ] **Step 7: Update WalletButton.tsx**

Replace all color token references:
- Connect button: `bg-white text-black hover:bg-gray-200 font-bold text-xs uppercase tracking-[0.15em] rounded-xl shadow-xl shadow-white/5` (was gold)
- Network indicator: `bg-green-500` (keep), text: `text-gray-400` (was `text-dust`)
- Account modal backgrounds: `bg-surface border-border` (was `bg-abyss border-edge`)
- Address text: `text-white font-mono` (was `text-chalk`)
- Disconnect button: `text-red-500` (was `text-nova`)

- [ ] **Step 8: Verify build + test locally**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/components/SidebarNavItem.tsx apps/web/src/components/GlobalSearch.tsx apps/web/src/components/AppShell.tsx apps/web/src/components/Footer.tsx apps/web/src/components/PageHeader.tsx apps/web/src/components/WalletButton.tsx
git commit -m "feat: replace top nav with collapsible sidebar + sticky header"
```

---

## Task 5: Build Dashboard Page + Stat Cards

**Files:**
- Create: `apps/web/src/components/StatCard.tsx`
- Create: `apps/web/src/components/MarketRow.tsx`
- Create: `apps/web/src/components/UtilizationBar.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/page.tsx` — redirect to /dashboard

- [ ] **Step 1: Create StatCard.tsx**

Directly from prototype, adapted for Next.js:

```tsx
import type { LucideIcon } from 'lucide-react'

type StatColor = 'accent' | 'green' | 'orange' | 'purple'

interface StatCardProps {
  title: string
  value: string
  subValue?: string
  icon: LucideIcon
  color: StatColor
}

const colorMap: Record<StatColor, { glow: string; iconBg: string; iconText: string }> = {
  accent:  { glow: 'bg-blue-500/5',   iconBg: 'bg-blue-500/10',   iconText: 'text-blue-500' },
  green:   { glow: 'bg-green-500/5',   iconBg: 'bg-green-500/10',   iconText: 'text-green-500' },
  orange:  { glow: 'bg-orange-500/5',  iconBg: 'bg-orange-500/10',  iconText: 'text-orange-500' },
  purple:  { glow: 'bg-purple-500/5',  iconBg: 'bg-purple-500/10',  iconText: 'text-purple-500' },
}

export function StatCard({ title, value, subValue, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="bg-surface p-8 rounded-[2rem] border border-border flex flex-col gap-4 group hover:border-accent/20 transition-all duration-500 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 ${c.glow} blur-[60px] -translate-y-1/2 translate-x-1/2`} />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-micro">{title}</span>
        <div className={`p-2.5 rounded-xl ${c.iconBg} border border-white/5`}>
          <Icon size={18} className={c.iconText} />
        </div>
      </div>
      <div className="flex flex-col relative z-10">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">{value}</span>
        {subValue && (
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">{subValue}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create UtilizationBar.tsx**

```tsx
export function UtilizationBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden border border-white/5">
      <div
        className="bg-accent h-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create MarketRow.tsx**

```tsx
import { UtilizationBar } from './UtilizationBar'

interface MarketRowProps {
  symbol: string
  totalLent: string
  lendApy: string
  borrowApy: string
  utilization: number
}

export function MarketRow({ symbol, totalLent, lendApy, borrowApy, utilization }: MarketRowProps) {
  return (
    <div className="grid grid-cols-5 gap-8 p-8 items-center hover:bg-white/[0.02] transition-all rounded-[2rem] border border-transparent hover:border-border group">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-border group-hover:border-accent/20 transition-colors font-bold text-xs text-gray-500">
          {symbol[0]}
        </div>
        <span className="font-bold text-base text-white tracking-tight">{symbol}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-white tracking-tighter font-mono">{totalLent}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Total Lent</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-green-500 tracking-tighter font-mono">{lendApy}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Lend APY</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-orange-500 tracking-tighter font-mono">{borrowApy}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Borrow APY</span>
      </div>
      <div className="flex flex-col items-end">
        <UtilizationBar percent={utilization} />
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-2">{utilization}% Utilized</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create dashboard/page.tsx**

```tsx
'use client'

import { Wallet, TrendingUp, Zap, ShieldCheck, Layers } from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { useAccount } from '@starknet-react/core'

export default function DashboardPage() {
  const { address } = useAccount()
  const { data: portfolio } = usePortfolio(address)
  const { data: balances } = useTokenBalances(address)

  // Compute stat values from existing hooks
  const totalLent = portfolio?.lending?.reduce((sum: number, p: any) => sum + (p.valueUsd ?? 0), 0) ?? 0
  const totalBorrowed = portfolio?.borrowing?.reduce((sum: number, p: any) => sum + (p.valueUsd ?? 0), 0) ?? 0
  const netWorth = totalLent + (balances?.totalUsd ?? 0) - totalBorrowed
  const healthFactor = totalBorrowed > 0 ? ((totalLent + (balances?.totalUsd ?? 0)) / totalBorrowed).toFixed(2) : '∞'

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-bold tracking-tighter text-white">Portfolio</h1>
          <p className="text-gray-500 mt-3 font-medium text-sm">
            Real-time overview of your StarkNet liquidity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard title="Net Worth" value={`$${netWorth.toLocaleString()}`} icon={Wallet} color="accent" />
        <StatCard title="Total Lent" value={`$${totalLent.toLocaleString()}`} icon={TrendingUp} color="green" />
        <StatCard title="Total Borrowed" value={`$${totalBorrowed.toLocaleString()}`} icon={Zap} color="orange" />
        <StatCard title="Health Factor" value={String(healthFactor)} icon={ShieldCheck} color="purple" />
      </div>

      {/* Active Positions + Your Assets — uses existing portfolio components, restyled */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-surface rounded-[2.5rem] border border-border overflow-hidden shadow-2xl shadow-black/20">
            <div className="p-10 border-b border-border flex items-center justify-between bg-white/[0.01]">
              <h2 className="text-micro">Active Positions</h2>
            </div>
            <div className="divide-y divide-border">
              {!address ? (
                <div className="p-10 text-center text-gray-600 text-sm">Connect wallet to see positions</div>
              ) : portfolio?.lending?.length === 0 && portfolio?.borrowing?.length === 0 ? (
                <div className="p-10 text-center text-gray-600 text-sm">No active positions</div>
              ) : (
                <>
                  {/* Render position rows here using portfolio data */}
                  {/* Wire up existing usePortfolio hook data */}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {/* Your Assets panel */}
          <div className="bg-surface rounded-[2.5rem] border border-border p-10 shadow-2xl shadow-black/20">
            <h2 className="text-micro mb-8 px-2">Your Assets</h2>
            <div className="space-y-2">
              {!address ? (
                <div className="text-center text-gray-600 text-sm py-4">Connect wallet</div>
              ) : (
                <div className="text-center text-gray-600 text-sm py-4">Loading...</div>
              )}
            </div>
          </div>

          {/* Stela Inscriptions CTA */}
          <div className="bg-accent rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-accent/20">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 border border-white/20">
                <Layers className="text-white" size={28} />
              </div>
              <h3 className="font-bold text-2xl mb-3 tracking-tight">Stela Inscriptions</h3>
              <p className="text-white/70 text-sm mb-8 leading-relaxed font-medium">
                Unlock the value of your inscriptions by using them as collateral.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: This is a starting point. The implementer should wire up actual position row rendering using `portfolio.lending` and `portfolio.borrowing` data from the existing `usePortfolio` hook, and token balance display from `useTokenBalances`. The exact data shapes should be checked against the existing hooks.

- [ ] **Step 5: Update root page.tsx**

Change the redirect from `/trade` to `/dashboard`:

```tsx
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/StatCard.tsx apps/web/src/components/MarketRow.tsx apps/web/src/components/UtilizationBar.tsx apps/web/src/app/dashboard/ apps/web/src/app/page.tsx
git commit -m "feat: add dashboard page with stat cards and market rows"
```

---

## Task 6: Update Redirects + Route Configuration

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Create stelas route directory**

```bash
mkdir -p /Users/address0/Documents/Repos/stela-app/apps/web/src/app/stelas
```

Copy `markets/page.tsx` to `stelas/page.tsx` and restyle it:

```bash
cp apps/web/src/app/markets/page.tsx apps/web/src/app/stelas/page.tsx
```

Then restyle `stelas/page.tsx` with new tokens (same as Task 7 restyle work).

- [ ] **Step 2: Update redirects in next.config.ts**

Find the redirects array and update:
1. Remove: `{ source: '/stelas', destination: '/markets', permanent: true }`
2. Add: `{ source: '/trade', destination: '/dashboard', permanent: true }`
3. Add: `{ source: '/markets', destination: '/stelas', permanent: true }`
4. Add: `{ source: '/markets/:pair', destination: '/stelas', permanent: true }`
5. Keep all other existing redirects

- [ ] **Step 2: Verify build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat: update redirects for dashboard and stelas routes"
```

---

## Task 7: Restyle Existing Pages (Batch)

**Files:** All page files in `src/app/`

This task reskins all existing pages by replacing old color token references. For each page:
- Replace `font-display` → `font-sans font-bold`
- Replace `text-star` → `text-accent`, `text-chalk` → `text-white`, `text-dust` → `text-gray-400`, `text-ash` → `text-gray-500`
- Replace `bg-void` → `bg-[#050505]`, `bg-surface` stays, `bg-abyss` → `bg-surface`, `bg-elevated` → `bg-surface-hover`
- Replace `border-edge` → `border-border`, `border-edge-bright` → `border-white/20`
- Replace `text-star-bright` → `text-accent/80`, `text-star-dim` → `text-accent/50`
- Replace `rounded-lg` → `rounded-xl` or `rounded-2xl` where appropriate
- Replace `variant="gold"` → `variant="default"` or `variant="accent"` on buttons

- [ ] **Step 1: Restyle borrow/page.tsx AND borrow/components/**

Update all Tailwind classes to new tokens in:
- `borrow/page.tsx`
- `borrow/components/InlineBorrowForm.tsx`
- `borrow/components/AddAssetModal.tsx`
- `borrow/components/AssetRow.tsx`

Use the Token Replacement Reference table above for all changes. Replace `font-display` with `font-sans font-bold`.

- [ ] **Step 2: Restyle swap/page.tsx**

Update all Tailwind classes to new tokens.

- [ ] **Step 3: Restyle stelas/page.tsx (copied from markets in Task 6)**

Update as stelas browsing page with new tokens. Also restyle `markets/components/FilterSection.tsx` if it's imported.

- [ ] **Step 4: Restyle portfolio/page.tsx**

Update with new tokens. Add stat cards row at top using `StatCard`.

- [ ] **Step 5: Restyle nft/page.tsx and nft/claim/page.tsx**

Update all gold references to accent blue.

- [ ] **Step 6: Restyle faucet/page.tsx**

Update all color references.

- [ ] **Step 7: Restyle stela/[id]/page.tsx**

Update detail page with new tokens.

- [ ] **Step 8: Restyle docs, faq, terms, privacy pages**

Quick token replacement across all four.

- [ ] **Step 9: Restyle inscription/[id] and order/[id] pages**

These pages still exist (even though redirects exist in next.config.ts). Replace old tokens.

- [ ] **Step 10: Verify build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: restyle all pages with new blue design tokens"
```

---

## Task 8: Restyle Domain Components (Batch)

**Files:** All component files in `src/components/` (excluding ui/ which was done in Task 3)

This task does a systematic find-and-replace of old design tokens across all 70+ domain components.

- [ ] **Step 1: Restyle orderbook components**

Update all 12 files in `components/orderbook/`:
- Replace star/void/chalk/dust/ash/edge color tokens
- Update rounded values
- Replace `font-display` references

- [ ] **Step 2: Restyle portfolio components**

Update all 5 files in `components/portfolio/`:
- Same token replacements

- [ ] **Step 3: Restyle trade components**

Update all 8 files in `components/trade/`:
- Same token replacements

- [ ] **Step 4: Restyle all remaining root components**

Update all remaining files in `components/`:
- `ConfirmDialog.tsx` — update dialog styling
- `TokenSelectorModal.tsx` — update modal + list styling
- `FeeBreakdown.tsx` — update colors
- `AssetInput.tsx` — use new input-base pattern
- `AssetBadge.tsx` — update badge colors
- `InscriptionActions.tsx`, `OrderActions.tsx` — update button variants
- `LendReviewModal.tsx`, `MatchFoundModal.tsx`, `QuickLendModal.tsx` — update modal styling
- `BuyShareModal.tsx`, `SellPositionModal.tsx`, `TransferSharesModal.tsx` — update modal styling
- `TransactionProgressModal.tsx`, `MultiSettleProgressModal.tsx` — update progress colors
- `NetworkMismatchBanner.tsx` — update to red/warning tokens
- `TermsGate.tsx` — update modal styling
- `ErrorBoundary.tsx` — update fallback UI colors
- All other components — systematic token replacement

- [ ] **Step 5: Verify build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/
git commit -m "feat: restyle all domain components with new design tokens"
```

---

## Task 9: Build StelaDetailsModal

**Files:**
- Create: `apps/web/src/components/StelaDetailsModal.tsx`

This modal opens from the Stelas grid page when clicking an inscription card. It shows a rich detail view without navigating to `/stela/[id]`.

- [ ] **Step 1: Create StelaDetailsModal.tsx**

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatAddress } from '@/lib/format'

interface StelaDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inscription: any // Use existing Inscription type from @stela/core
}

export function StelaDetailsModal({ open, onOpenChange, inscription }: StelaDetailsModalProps) {
  if (!inscription) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-400">
              {inscription.id ? formatAddress(inscription.id) : ''}
            </span>
            <Badge>{inscription.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-micro">Borrower</span>
              <p className="font-mono text-sm text-white mt-1">
                {inscription.borrower ? formatAddress(inscription.borrower) : '—'}
              </p>
            </div>
            <div>
              <span className="text-micro">Lender</span>
              <p className="font-mono text-sm text-white mt-1">
                {inscription.lender ? formatAddress(inscription.lender) : '—'}
              </p>
            </div>
            <div>
              <span className="text-micro">Duration</span>
              <p className="text-sm text-white mt-1">
                {inscription.duration ? `${Number(inscription.duration) / 86400} days` : 'Instant'}
              </p>
            </div>
            <div>
              <span className="text-micro">Multi-Lender</span>
              <p className="text-sm text-white mt-1">
                {inscription.multi_lender ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {/* Action buttons — these will wire into existing hooks */}
          <div className="flex gap-4">
            <Button variant="default" className="flex-1">Lend</Button>
            <Button variant="outline" className="flex-1">View Details</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Note: This is a scaffold. The implementer should enrich it by looking at the existing `stela/[id]/page.tsx` detail page and the prototype's Stela Details Modal for the full data display (assets list, action buttons, etc.).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/StelaDetailsModal.tsx
git commit -m "feat: add StelaDetailsModal for inscription quick-view"
```

---

## Task 10: Final Verification & Cleanup

**Files:** Various

- [ ] **Step 1: Search for any remaining old token references**

```bash
cd /Users/address0/Documents/Repos/stela-app/apps/web/src
grep -r "text-star\|text-chalk\|text-dust\|text-ash\|bg-void\|bg-abyss\|bg-elevated\|border-edge\|font-display\|text-star-bright\|text-star-dim\|star-dim\|star-bright\|color-star\|color-void\|color-abyss\|color-elevated\|color-edge\|color-chalk\|color-dust\|color-ash\|color-ember\|color-cosmic\|color-nebula\|color-aurora\|color-nova" --include="*.tsx" --include="*.ts" --include="*.css" -l
```

Expected: Zero matches (or only in comments/strings that don't affect rendering).

- [ ] **Step 2: Fix any remaining references found**

If grep finds files, update them.

- [ ] **Step 3: Search for old button variants**

```bash
grep -r "variant=\"gold\"\|variant=\"aurora\"\|variant=\"nova\"\|variant=\"cosmic\"" --include="*.tsx" -l
```

Expected: Zero matches.

- [ ] **Step 4: Verify full build**

```bash
cd /Users/address0/Documents/Repos/stela-app && pnpm --filter web build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 5: Add .superpowers to .gitignore if not present**

```bash
echo ".superpowers/" >> apps/web/.gitignore
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: cleanup old token references and finalize UI redesign"
```

---

## Execution Order & Dependencies

```
Task 1 (fonts + motion) → Task 2 (globals.css) → Task 3 (ALL ui components)
                                                         ↓
Task 4 (sidebar + header + AppShell) ← depends on Task 3
         ↓
Task 5 (dashboard page + stat cards) ← depends on Task 4
         ↓
Task 6 (stelas route + redirects) ← depends on Task 5
         ↓
Task 7 (restyle pages) → sequential, one page at a time
         ↓
Task 8 (restyle domain components) → sequential after Task 7
         ↓
Task 9 (StelaDetailsModal) ← depends on Task 8
         ↓
Task 10 (verification + cleanup) ← depends on all above
```

**Estimated total:** 10 tasks, ~55 steps
