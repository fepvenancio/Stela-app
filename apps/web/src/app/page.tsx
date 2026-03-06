import Link from 'next/link'
import { Button } from '@/components/ui/button'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function Numeral({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-6xl sm:text-7xl lg:text-8xl text-star/10 select-none leading-none" aria-hidden="true">
      {children}
    </span>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center min-w-[100px]">
      <div className="font-display text-2xl sm:text-3xl text-chalk tracking-tight">{value}</div>
      <div className="text-[11px] text-dust uppercase tracking-[0.2em] mt-1">{label}</div>
    </div>
  )
}

/* ─── Icons (each used exactly once) ─────────────────────────────────────── */

const icon = {
  handshake: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 11.5L14 18l-3-3-5 5" /><path d="M20.5 16.5v-5h-5" /><path d="M3.5 7.5L10 1l3 3 5-5" /><path d="M3.5 2.5v5h5" />
    </svg>
  ),
  hourglass: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22" /><path d="M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" />
    </svg>
  ),
  split: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 00-1.172-2.872L3 3" /><path d="M15.828 10.828L21 3" />
    </svg>
  ),
  signature: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17c1.5-3 3-5 4.5-5s2 2 3.5 2 2.5-3 4-3 2.5 4 4 4 2-2 4-6" /><path d="M2 21h20" />
    </svg>
  ),
  vault: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="12" cy="12" r="4" /><path d="M12 8v8" /><path d="M8 12h8" />
    </svg>
  ),
  relay: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  gem: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3l1 10" /><path d="M2 9h20" /><path d="M6.5 3L12 13" /><path d="M17.5 3L12 13" />
    </svg>
  ),
  receipt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 10h8" /><path d="M8 14h4" />
    </svg>
  ),
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col overflow-hidden -mt-4 sm:-mt-8">

      {/* ── 1. HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-center pt-12 pb-24 px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-star/[0.04] rounded-full blur-[140px] -z-10" />

        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Copy */}
          <div className="animate-fade-up">
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-6">
              P2P Lending on StarkNet
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl tracking-tight text-chalk leading-[1.1] mb-6">
              Lend directly.<br />
              No pools.<br />
              <span className="text-star">No oracles.</span>
            </h1>
            <p className="text-dust text-base sm:text-lg leading-relaxed mb-10 max-w-md">
              Every position is an isolated, peer-to-peer agreement.
              Collateral locked in its own contract. Terms set by you.
              0.30% total fees.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-8 h-13 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_-2px_rgba(232,168,37,0.4)] cursor-pointer">
                <Link href="/browse">Browse Stelas</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-edge hover:border-star/40 hover:bg-surface text-chalk px-8 h-13 rounded-full transition-all cursor-pointer">
                <Link href="/create">Create Order</Link>
              </Button>
            </div>
          </div>

          {/* Right: Mock inscription card */}
          <div className="hidden lg:block animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="bg-abyss/80 border border-edge/40 rounded-3xl p-8 relative backdrop-blur-sm granite-noise overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-star/[0.06] rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] text-chalk/60 uppercase tracking-[0.25em] font-mono">Stela #0042</span>
                  <span className="text-[10px] bg-aurora/10 text-aurora px-2.5 py-1 rounded-full font-mono uppercase tracking-wider">Open</span>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-xs">Debt</span>
                    <span className="text-chalk font-mono text-sm">5,000 <span className="text-dust">USDC</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/30" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-xs">Interest</span>
                    <span className="text-star font-mono text-sm">250 <span className="text-dust">USDC</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/30" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-xs">Collateral</span>
                    <span className="text-chalk font-mono text-sm">2.8 <span className="text-dust">ETH</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/30" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-xs">Duration</span>
                    <span className="text-chalk font-mono text-sm">30 days</span>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-edge/20">
                  <div>
                    <span className="text-[10px] text-chalk/60 uppercase tracking-widest">APY</span>
                    <div className="text-star font-display text-xl tracking-wide">60.83%</div>
                  </div>
                  <div className="w-28 h-9 rounded-full bg-star/10 border border-star/30 flex items-center justify-center text-star text-xs font-semibold cursor-pointer hover:bg-star/20 transition-colors" tabIndex={-1} aria-hidden="true">
                    Fund this
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-edge/15">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap justify-center gap-8 sm:gap-12">
            <Stat value="0.20%" label="Lending Fee" />
            <Stat value="0.10%" label="Swap Fee" />
            <Stat value="0.10%" label="Redemption Fee" />
            <Stat value="0%" label="Liquidation Fee" />
            <Stat value="50%" label="Max NFT Discount" />
          </div>
        </div>
      </section>

      {/* ── 2. THREE PILLARS ─────────────────────────────────── */}
      <section className="px-4 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto">
          <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Why Stela</p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight mb-16 max-w-xl">
            Lending without the middlemen
          </h2>

          <div className="grid lg:grid-cols-3 gap-px bg-edge/20 rounded-3xl overflow-hidden">
            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-star/10 flex items-center justify-center text-star mb-6 group-hover:scale-110 transition-transform">
                {icon.split}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">Isolated Positions</h3>
              <p className="text-dust text-sm leading-relaxed">
                Every loan deploys its own Locker contract. Your collateral is never pooled
                with other users. No shared risk, no contagion.
              </p>
            </div>

            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora mb-6 group-hover:scale-110 transition-transform">
                {icon.hourglass}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">Time, Not Price</h3>
              <p className="text-dust text-sm leading-relaxed">
                Liquidation is based on time, not price feeds. No oracle manipulation,
                no cascading liquidations. The clock is the only judge.
              </p>
            </div>

            <div className="bg-abyss p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-xl bg-nebula/10 flex items-center justify-center text-nebula mb-6 group-hover:scale-110 transition-transform">
                {icon.handshake}
              </div>
              <h3 className="font-display text-lg text-chalk uppercase tracking-wider mb-3">Direct Agreement</h3>
              <p className="text-dust text-sm leading-relaxed">
                Borrowers set the terms. Lenders choose what to fund.
                No intermediary, no governance vote, no committee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. THE LIFECYCLE ─────────────────────────────────── */}
      <section className="px-4 py-24 sm:py-32 border-t border-edge/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20">
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight max-w-lg mb-4">
              Four steps, fully on-chain
            </h2>
            <p className="text-dust text-sm leading-relaxed max-w-xl">
              Every lending position follows the same clear lifecycle.
              From inscription to redemption, each step is transparent and verifiable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16 lg:gap-y-20">
            {/* Step I */}
            <div className="flex items-center gap-6">
              <Numeral>I</Numeral>
              <div>
                <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Inscribe</h3>
                <p className="text-dust text-sm leading-relaxed">
                  Define your terms: debt, interest, collateral, and duration.
                  Your collateral is locked in a dedicated Locker contract — isolated from everyone else.
                </p>
              </div>
            </div>

            {/* Step II */}
            <div className="flex items-center gap-6">
              <Numeral>II</Numeral>
              <div>
                <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Fund</h3>
                <p className="text-dust text-sm leading-relaxed">
                  A lender provides the debt assets and receives ERC1155 shares as proof of their claim.
                  The borrower gets their liquidity instantly.
                </p>
              </div>
            </div>

            {/* Step III */}
            <div className="flex items-center gap-6">
              <Numeral>III</Numeral>
              <div>
                <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Repay</h3>
                <p className="text-dust text-sm leading-relaxed">
                  Return the debt plus interest before the duration expires.
                  Collateral is released. If time runs out, lenders claim the collateral.
                </p>
              </div>
            </div>

            {/* Step IV */}
            <div className="flex items-center gap-6">
              <Numeral>IV</Numeral>
              <div>
                <h3 className="font-display text-base text-chalk uppercase tracking-widest mb-2">Redeem</h3>
                <p className="text-dust text-sm leading-relaxed">
                  After repayment or liquidation, shareholders burn their ERC1155 tokens
                  for a proportional share of the underlying assets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. GASLESS + FEES (Split Layout) ─────────────────── */}
      <section className="px-4 py-24 sm:py-32 border-t border-edge/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 lg:gap-16">

          {/* Left: Gasless orders — 3 cols */}
          <div className="lg:col-span-3">
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Off-Chain Signatures</p>
            <h2 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight mb-6">
              Create orders for free
            </h2>
            <p className="text-dust text-sm leading-relaxed mb-10 max-w-lg">
              Sign SNIP-12 typed data with your wallet — no gas, no on-chain transaction.
              When a lender matches your order, a relayer bot settles it on-chain automatically.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star flex-shrink-0 mt-0.5">
                  {icon.signature}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Sign, Don&apos;t Transact</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    Your signed intent is stored off-chain until a lender matches it.
                    Cancel anytime with another signature.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora flex-shrink-0 mt-0.5">
                  {icon.relay}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Permissionless Relayers</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    Anyone can call <span className="font-mono text-xs text-star">settle()</span> and
                    earn 0.05% per trade. No whitelist needed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Fees — 2 cols */}
          <div className="lg:col-span-2">
            <div className="bg-abyss/60 border border-edge/30 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden h-full">
              <div className="absolute inset-0 bg-gradient-to-b from-star/[0.02] to-transparent pointer-events-none" />

              <div className="relative z-10">
                <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-6">Protocol Fees</p>

                <div className="space-y-5 mb-8">
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Settlement</span>
                    <span className="font-display text-xl text-chalk">0.20<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Swap</span>
                    <span className="font-display text-xl text-chalk">0.10<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Redemption</span>
                    <span className="font-display text-xl text-chalk">0.10<span className="text-sm text-dust">%</span></span>
                  </div>
                  <div className="w-full h-px bg-edge/20" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-dust text-sm">Liquidation</span>
                    <span className="font-display text-xl text-chalk">0<span className="text-sm text-dust">%</span></span>
                  </div>
                </div>

                <div className="bg-void/60 rounded-2xl p-5 border border-edge/15">
                  <div className="font-display text-2xl text-star mb-1">0.30%</div>
                  <p className="text-dust text-xs leading-relaxed">
                    Total round-trip. Aave and Compound charge 0.50–1.00%.
                    Genesis NFT holders pay up to 50% less.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. GENESIS NFT ───────────────────────────────────── */}
      <section className="px-4 py-24 sm:py-32 border-t border-edge/10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: Genesis card */}
          <div className="bg-star/[0.03] border border-star/15 rounded-3xl p-8 sm:p-10 relative overflow-hidden granite-noise">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-star/[0.06] rounded-full blur-[70px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-xl bg-star/10 border border-star/25 flex items-center justify-center text-star">
                  {icon.gem}
                </div>
                <div>
                  <h3 className="font-display text-xl text-star uppercase tracking-wider">Genesis NFT</h3>
                  <p className="text-[10px] text-dust uppercase tracking-widest">ERC721 on StarkNet</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Supply</span>
                  <span className="text-chalk font-display text-lg tracking-wider">300</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Mint Price</span>
                  <span className="text-star font-display text-lg tracking-wider">1,000 STRK</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Max Per Wallet</span>
                  <span className="text-chalk font-display text-lg tracking-wider">5</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-edge/15">
                  <span className="text-dust text-sm">Max Discount</span>
                  <span className="text-star font-display text-lg tracking-wider">50%</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-dust text-sm">Staking Required</span>
                  <span className="text-aurora text-sm tracking-wider">No</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Copy */}
          <div>
            <p className="text-star font-mono text-xs uppercase tracking-[0.3em] mb-4">Genesis Collection</p>
            <h2 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight mb-6">
              Hold the NFT, pay less fees
            </h2>
            <p className="text-dust leading-relaxed mb-8">
              Genesis holders get automatic fee discounts — checked on-chain at transaction time.
              No staking, no claiming, no lock-up. Sell the NFT and the discount transfers
              to the new owner.
            </p>

            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-cosmic/10 flex items-center justify-center text-cosmic flex-shrink-0 mt-0.5">
                  {icon.receipt}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Discount Model</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    15% base discount with 1+ NFT. Additional bonuses for volume tiers
                    and multi-NFT holdings, capped at 50%.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-ember/10 flex items-center justify-center text-ember flex-shrink-0 mt-0.5">
                  {icon.vault}
                </div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Transparent Treasury</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    50 NFTs minted to treasury on deploy — hardcoded in the constructor.
                    Ownership renounced after launch. Fully immutable.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button asChild variant="outline" className="border-star/30 hover:border-star hover:bg-star/5 text-star px-6 h-11 rounded-full transition-all cursor-pointer">
                <Link href="/genesis">Mint Genesis NFT</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. CTA ───────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32 text-center px-4 border-t border-edge/10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-star/[0.07] rounded-full blur-[100px] -z-10" />
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-star/40 to-transparent mx-auto mb-10" />
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-chalk tracking-tight mb-6">
          Ready?
        </h2>
        <p className="text-dust mb-10 max-w-md mx-auto leading-relaxed">
          Create a lending order in seconds. Browse existing positions.
          Or mint a Genesis NFT for fee discounts.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-12 h-14 rounded-full text-lg shadow-[0_0_20px_-2px_rgba(232,168,37,0.45)] transition-all hover:scale-105 active:scale-95 cursor-pointer">
            <Link href="/browse">Explore Stelas</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-edge hover:border-star/30 hover:bg-surface text-chalk px-12 h-14 rounded-full text-lg transition-all cursor-pointer">
            <Link href="/create">Create Order</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
