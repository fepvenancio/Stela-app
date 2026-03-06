# Stela Design System — Cross-Page Consistency Reference

Derived from the redesigned landing page + audit of all 10 app pages.
Apply these tokens when building or modifying any page.

---

## 1. Typography Hierarchy

| Role | Tailwind Classes | Usage |
|------|-----------------|-------|
| **Page title (h1)** | `font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight` | One per page, left-aligned or centered depending on context |
| **Section heading (h2)** | `font-display text-2xl sm:text-3xl text-chalk tracking-tight` | Section intros within a page |
| **Card heading (h3)** | `font-display text-lg text-chalk uppercase tracking-wider` | Inside cards or feature blocks |
| **Item heading (h4)** | `text-chalk text-sm font-semibold` | List items, form section titles |
| **Section label** | `text-star font-mono text-xs uppercase tracking-[0.3em] mb-4` | Gold monospace micro-label above headings |
| **Body text** | `text-dust text-sm leading-relaxed` | Default paragraph text |
| **Hero body** | `text-dust text-base sm:text-lg leading-relaxed` | Landing/hero intro paragraphs |
| **Stat value** | `font-display text-2xl sm:text-3xl text-chalk tracking-tight` | Metrics, numbers |
| **Stat label** | `text-[11px] text-ash uppercase tracking-[0.2em]` | Below stat values |
| **Mono/code** | `font-mono text-xs text-star` | Contract calls, addresses, code refs |
| **Table header** | `text-[10px] text-ash uppercase tracking-widest font-bold` | Column headers in tables/lists |

**Rules:**
- Cinzel (`font-display`) for headings ONLY — never for body text
- No italic gold `<span>` in headings (removed in landing redesign)
- Minimum readable size: 11px for labels, never below 9px even in diagrams

---

## 2. Card & Container Patterns

| Type | Tailwind Classes | When to Use |
|------|-----------------|-------------|
| **Primary card** | `bg-abyss/60 border border-edge/30 rounded-3xl p-6 sm:p-8` | Main content containers, feature blocks |
| **Secondary card** | `bg-surface/20 border border-edge/20 rounded-2xl p-5` | Supporting info, sub-sections |
| **Featured card** | `bg-abyss/80 border border-edge/40 rounded-3xl p-8 granite-noise relative overflow-hidden` | Hero elements, highlighted content |
| **Accent card** | `bg-star/[0.03] border border-star/15 rounded-3xl p-8 granite-noise` | Genesis NFT, premium features |
| **Data row** | `bg-void/40 rounded-2xl p-4 border border-edge/20` | List items, table rows |
| **Inline chip** | `bg-surface/40 border border-edge/20 rounded-full px-3 py-1 text-xs` | Tags, status badges, specs |

**Rules:**
- `rounded-3xl` for primary/featured cards, `rounded-2xl` for secondary
- `granite-noise` only on featured/accent cards (not every card)
- Cards should NOT all look identical on a page — vary between primary/secondary

---

## 3. Empty State Pattern

```
<div class="text-center py-16">
  <div class="w-12 h-12 rounded-2xl bg-surface border border-edge/30 flex items-center justify-center text-dust mx-auto mb-4">
    {/* contextual icon */}
  </div>
  <p class="text-dust text-sm mb-4">{message}</p>
  <Button variant="outline" size="sm">
    <Link href="/{action}">{cta}</Link>
  </Button>
</div>
```

**Rules:**
- Always include a CTA button (not just text)
- Use ONE shared empty-state icon pattern (don't create slight variations)
- Message should be specific: "No open orders yet" not "Nothing here"

---

## 4. Error State Pattern

```
<div class="text-center py-16">
  <p class="text-nova text-sm mb-4">{error message}</p>
  <Button variant="outline" size="sm">
    <Link href="/browse">Back to Browse</Link>
  </Button>
</div>
```

**Rules:**
- Always include navigation back (never strand the user)
- Use `text-nova` for error text
- For inline form errors: `text-nova text-xs mt-1` below the field, with `role="alert"`

---

## 5. Icon Usage Rules

- Each unique SVG icon should appear **once per page** max
- Prefer `w-9 h-9 rounded-xl bg-{color}/10` icon boxes for feature lists
- Prefer `w-10 h-10 rounded-xl` for card headers
- Use `w-12 h-12 rounded-2xl` only for page-level hero elements
- All icons: `strokeWidth="1.5"` for consistency
- Back arrow: extract to shared `<BackArrow>` component (used in 3+ pages)
- Lock icon: extract to shared `<LockIcon>` (used in 3+ pages)

---

## 6. Spacing Rhythm

| Context | Value |
|---------|-------|
| **Page vertical padding** | `py-24 sm:py-32` for sections, `pt-12 pb-24` for hero |
| **Section gap** | `border-t border-edge/10` between sections (not just whitespace) |
| **Card padding** | `p-6 sm:p-8` primary, `p-5` secondary |
| **Card gap in grids** | `gap-6` for cards, `gap-12 lg:gap-16` for split layouts |
| **Heading to content** | `mb-6` after h2, `mb-3` after h3, `mb-16 sm:mb-20` after section intro |
| **Label to heading** | `mb-4` after section label |
| **Max content width** | `max-w-6xl mx-auto` (consistent across all pages) |
| **Form field gap** | `space-y-4` between fields, `space-y-6` between field groups |

---

## 7. Color Role Mapping

| Role | Color | Token | Usage |
|------|-------|-------|-------|
| **Primary/CTA** | Gold | `star` | Buttons, primary actions, active states, section labels |
| **Debt assets** | Indigo | `nebula` | Debt token badges, debt-related UI |
| **Collateral assets** | Gold | `star` | Collateral indicators, lock icons |
| **Interest assets** | Green | `aurora` | Interest amounts, yield, success states |
| **Error/danger** | Red | `nova` | Errors, liquidation, destructive actions |
| **Secondary accent** | Amber | `ember` | Warm highlights, secondary features |
| **Tertiary accent** | Purple | `cosmic` | Rare/premium features, Genesis NFT tier |
| **Primary text** | Light gray | `chalk` | Headings, important values |
| **Secondary text** | Medium gray | `dust` | Body text, descriptions |
| **Tertiary text** | Dark gray | `ash` | Labels, captions, timestamps |

**CRITICAL:** This mapping must be consistent across ALL detail pages.
Currently `stela/[id]` swaps debt/collateral colors vs `inscription/[id]` — fix to match this table.

---

## 8. Page Header Pattern

```
<div class="mb-8">
  <p class="text-star font-mono text-xs uppercase tracking-[0.3em] mb-2">{label}</p>
  <div class="flex items-end justify-between gap-4">
    <h1 class="font-display text-3xl sm:text-4xl text-chalk tracking-tight">{title}</h1>
    <Button>  {/* optional CTA */}  </Button>
  </div>
  <p class="text-dust text-sm mt-2 max-w-lg">{optional subtitle}</p>
</div>
```

**Rules:**
- Gold mono section label above title
- Title left-aligned (not centered) on app pages
- Optional CTA right-aligned on the same row as title
- Landing page hero can be centered; all other pages left-aligned

---

## 9. Mobile Patterns

- All grids must have responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Tab lists with 4+ items: add `overflow-x-auto` with `flex-nowrap`
- Hover-only interactions (opacity reveal on hover) must also show on mobile: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`
- Touch targets minimum `h-10 w-10` (40px) for interactive elements
- Forms: full-width inputs on mobile, no side-by-side fields below `sm:`

---

## Bug Fix Checklist (from audit)

- [ ] Portfolio `line 243`: Replace dynamic class interpolation with static class lookup object
- [ ] Order detail `lines 39-53, 266-296`: Remove all `privateMode` / privacy pool dead code
- [ ] Genesis claim `lines 22-25`: Fix `getDiscountTier()` — "Holder" maps to two ranges
- [ ] Docs `line 320`: Update fee info to "15% base + 5%/tier + 2%/NFT, cap 50%"
- [ ] Detail pages: Align `ROLE_META` colors — debt=nebula, collateral=star everywhere
- [ ] Genesis claim `line 76`: Change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`
- [ ] Genesis claim `line 38`: Add `mx-auto`
- [ ] Faucet header: Align to `font-display uppercase tracking-widest`
- [ ] All detail error states: Add "Back to Browse" link
- [ ] Docs page: Add section `id` attributes + sticky TOC
