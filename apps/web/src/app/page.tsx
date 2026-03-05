import Link from 'next/link'
import { Button } from '@/components/ui/button'

/* ─── Reusable sub-components ─────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] sm:text-xs text-star uppercase tracking-[0.25em] font-bold font-mono block mb-4">
      {children}
    </span>
  )
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-3xl sm:text-4xl lg:text-5xl text-chalk tracking-tight leading-tight ${className}`}>
      {children}
    </h2>
  )
}

function Divider() {
  return <div className="w-24 h-px bg-gradient-to-r from-transparent via-star/50 to-transparent mx-auto" />
}

function FlowNode({
  label,
  description,
  accent = 'star',
  icon,
}: {
  label: string
  description: string
  accent?: 'star' | 'nebula' | 'aurora' | 'nova' | 'chalk'
  icon: React.ReactNode
}) {
  const colorMap = {
    star: 'border-star/30 text-star bg-star/5',
    nebula: 'border-nebula/30 text-nebula bg-nebula/5',
    aurora: 'border-aurora/30 text-aurora bg-aurora/5',
    nova: 'border-nova/30 text-nova bg-nova/5',
    chalk: 'border-edge/40 text-chalk bg-surface/30',
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${colorMap[accent]} transition-all`}>
        {icon}
      </div>
      <div className="font-display text-xs sm:text-sm uppercase tracking-widest text-chalk">{label}</div>
      <p className="text-[11px] text-dust leading-relaxed max-w-[140px]">{description}</p>
    </div>
  )
}

function FlowArrow({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center py-1">
        <div className="w-px h-6 bg-gradient-to-b from-star/30 to-star/10" />
        <svg width="8" height="6" viewBox="0 0 8 6" className="text-star/40">
          <path d="M4 6L0 0h8z" fill="currentColor" />
        </svg>
      </div>
    )
  }
  return (
    <div className="hidden md:flex items-center px-1">
      <div className="h-px w-6 lg:w-10 bg-gradient-to-r from-star/30 to-star/10" />
      <svg width="6" height="8" viewBox="0 0 6 8" className="text-star/40 -ml-px">
        <path d="M6 4L0 0v8z" fill="currentColor" />
      </svg>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  accent = 'star',
}: {
  icon: React.ReactNode
  title: string
  description: string
  accent?: string
}) {
  const accentColor: Record<string, string> = {
    star: 'bg-star/10 text-star',
    nebula: 'bg-nebula/10 text-nebula',
    aurora: 'bg-aurora/10 text-aurora',
    nova: 'bg-nova/10 text-nova',
    cosmic: 'bg-cosmic/10 text-cosmic',
    ember: 'bg-ember/10 text-ember',
  }

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all granite-noise relative overflow-hidden">
      <div className={`w-11 h-11 rounded-xl ${accentColor[accent] || accentColor.star} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform relative z-10`}>
        {icon}
      </div>
      <h3 className="font-display text-base sm:text-lg text-chalk mb-2 uppercase tracking-wider relative z-10">{title}</h3>
      <p className="text-dust text-sm leading-relaxed relative z-10">{description}</p>
    </div>
  )
}

/* ─── Icons (inline SVGs) ─────────────────────────────────────────────────── */

const icons = {
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  lock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  pen: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  coins: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1110.34 18" /><path d="M7 6h1v4" />
    </svg>
  ),
  eye: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  bolt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  layers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  grid: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  vault: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="12" cy="12" r="4" /><path d="M12 8v8" /><path d="M8 12h8" />
    </svg>
  ),
  checkCircle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  tree: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V8" /><path d="M5 12H2l10-10 10 10h-3" /><path d="M8 22h8" />
    </svg>
  ),
  hash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  scale: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3l5 5-5 5" /><path d="M21 8H9" /><path d="M8 21l-5-5 5-5" /><path d="M3 16h12" />
    </svg>
  ),
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24 sm:gap-32 lg:gap-40 pb-32 overflow-hidden">

      {/* ── 1. Hero ──────────────────────────────────────────── */}
      <section className="relative pt-16 md:pt-24 min-h-[70vh] flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-star/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center animate-fade-up px-4 relative z-20">
          <h1 className="font-display text-5xl sm:text-6xl md:text-8xl tracking-tighter text-chalk mb-8 leading-tight">
            Inscribe Your <span className="text-star">Legacy</span>
          </h1>
          <p className="text-dust text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
            A decentralized, peer-to-peer lending protocol on StarkNet.
            Direct, private, and carved into the blockchain through digital inscriptions.
            Genesis NFT holders earn a perpetual share of all protocol fees.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-10 h-14 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(232,168,37,0.4)] text-lg">
              <Link href="/browse">Explore Stelas</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-edge hover:bg-surface text-chalk px-10 h-14 rounded-full transition-all text-lg">
              <Link href="/create">Inscribe Now</Link>
            </Button>
          </div>
        </div>

        {/* Floating stone decorations */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between px-10 md:px-20 pointer-events-none opacity-20 grayscale -z-10">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="w-32 md:w-48 h-64 md:h-96 bg-gradient-to-b from-surface to-void border-x border-t border-edge/40 rounded-t-2xl relative overflow-hidden"
              style={{
                transform: `translateY(${i % 2 === 0 ? '40px' : '80px'}) rotate(${i % 2 === 0 ? '-5deg' : '5deg'})`,
                animation: `drift ${15 + i * 5}s ease-in-out infinite alternate`,
              }}
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/granite.png')] opacity-20" />
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. What is Stela? ────────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>The Protocol</SectionLabel>
          <SectionTitle>
            Lending without <span className="text-star italic">intermediaries</span>
          </SectionTitle>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-star/10 flex items-center justify-center text-star mb-6 group-hover:scale-110 transition-transform">
              {icons.shield}
            </div>
            <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">No Pools</h3>
            <p className="text-dust text-sm leading-relaxed">
              Every lending position is a direct, isolated agreement. Your collateral is never mixed with others. No pool risk, no impermanent loss.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-nebula/10 flex items-center justify-center text-nebula mb-6 group-hover:scale-110 transition-transform">
              {icons.users}
            </div>
            <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">No Oracles</h3>
            <p className="text-dust text-sm leading-relaxed">
              Stela uses time-based liquidation, not price feeds. No oracle manipulation risk. If the borrower defaults on time, the lender claims the collateral.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-aurora/10 flex items-center justify-center text-aurora mb-6 group-hover:scale-110 transition-transform">
              {icons.bolt}
            </div>
            <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">Pure P2P</h3>
            <p className="text-dust text-sm leading-relaxed">
              Borrowers define terms. Lenders choose what to fund. Direct interaction with transparent, on-chain fees (0.35% round-trip). Your assets, your terms, your inscription.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. How It Works ──────────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>The Lifecycle</SectionLabel>
          <SectionTitle>
            How <span className="text-star italic">Stela</span> works
          </SectionTitle>
          <p className="text-dust mt-6 max-w-2xl mx-auto leading-relaxed">
            Every lending position follows a clear, predictable lifecycle. From inscription to redemption, each step is transparent and verifiable on-chain.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="bg-void/40 border border-edge/20 rounded-[40px] p-8 sm:p-12 lg:p-16 relative overflow-hidden granite-noise">
          {/* Desktop: Horizontal flow */}
          <div className="hidden md:flex items-start justify-center gap-0">
            <FlowNode
              label="Inscribe"
              description="Lock collateral, define debt, interest, and duration"
              accent="star"
              icon={icons.pen}
            />
            <FlowArrow />
            <FlowNode
              label="Sign"
              description="Lender provides debt, receives ERC1155 shares"
              accent="nebula"
              icon={icons.lock}
            />
            <FlowArrow />
            <FlowNode
              label="Repay"
              description="Borrower returns debt + interest before expiry"
              accent="aurora"
              icon={icons.coins}
            />
            <FlowArrow />
            <FlowNode
              label="Redeem"
              description="Shareholders claim their portion of the assets"
              accent="chalk"
              icon={icons.checkCircle}
            />
          </div>

          {/* Mobile: Vertical flow */}
          <div className="flex md:hidden flex-col items-center gap-0">
            <FlowNode label="Inscribe" description="Lock collateral, define debt, interest, and duration" accent="star" icon={icons.pen} />
            <FlowArrow vertical />
            <FlowNode label="Sign" description="Lender provides debt, receives ERC1155 shares" accent="nebula" icon={icons.lock} />
            <FlowArrow vertical />
            <FlowNode label="Repay" description="Borrower returns debt + interest before expiry" accent="aurora" icon={icons.coins} />
            <FlowArrow vertical />
            <FlowNode label="Redeem" description="Shareholders claim their portion of the assets" accent="chalk" icon={icons.checkCircle} />
          </div>

          {/* Liquidation path */}
          <div className="mt-10 pt-8 border-t border-edge/15 flex flex-col items-center gap-2">
            <p className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold mb-3">If borrower defaults</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-nova/30 bg-nova/5 flex items-center justify-center text-nova">
                {icons.clock}
              </div>
              <div>
                <span className="text-nova text-xs font-display uppercase tracking-widest">Liquidation</span>
                <p className="text-[11px] text-dust">Duration expires unpaid. Lenders claim the locked collateral proportionally.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed step descriptions */}
        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          <div className="space-y-8">
            <div className="flex gap-6 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-xl group-hover:border-star/50 transition-all">I</div>
              <div>
                <h4 className="text-chalk text-lg font-display uppercase tracking-widest mb-2 group-hover:text-star transition-colors">Inscribe the Stela</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Lock your collateral into a new inscription. Define your terms -- debt requested, interest offered, and the duration. Each inscription deploys its own <span className="text-chalk">isolated Locker contract</span>.
                </p>
              </div>
            </div>
            <div className="flex gap-6 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-xl group-hover:border-star/50 transition-all">II</div>
              <div>
                <h4 className="text-chalk text-lg font-display uppercase tracking-widest mb-2 group-hover:text-star transition-colors">Seal the Agreement</h4>
                <p className="text-dust text-sm leading-relaxed">
                  A lender signs the inscription, providing the debt assets. The <span className="text-star/80">borrower receives the liquidity immediately</span>, while the lender receives ERC1155 shares as proof of their claim.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="flex gap-6 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-xl group-hover:border-star/50 transition-all">III</div>
              <div>
                <h4 className="text-chalk text-lg font-display uppercase tracking-widest mb-2 group-hover:text-star transition-colors">Repay or Default</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Repay the debt plus interest before expiry to reclaim your collateral. If the duration ends unpaid, the <span className="text-nova/80">collateral is forfeit</span> and lenders can liquidate.
                </p>
              </div>
            </div>
            <div className="flex gap-6 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-xl group-hover:border-star/50 transition-all">IV</div>
              <div>
                <h4 className="text-chalk text-lg font-display uppercase tracking-widest mb-2 group-hover:text-star transition-colors">Redeem Shares</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Once a Stela is <span className="text-aurora">repaid</span> or <span className="text-nova">liquidated</span>, shareholders redeem their ERC1155 tokens for their proportional share of the underlying assets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Off-Chain Signatures ──────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <SectionLabel>Gasless Orders</SectionLabel>
            <SectionTitle className="mb-6">
              Create offers for <span className="text-star italic">free</span>
            </SectionTitle>
            <p className="text-dust leading-relaxed mb-8">
              Stela supports off-chain SNIP-12 typed data signatures. Borrowers and lenders can create
              and accept lending offers without paying any gas. A relayer bot settles matched orders
              on-chain automatically.
            </p>
            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-star/10 flex items-center justify-center text-star flex-shrink-0 mt-0.5">{icons.pen}</div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Sign, Don&apos;t Transact</h4>
                  <p className="text-dust text-sm leading-relaxed">Create lending orders with just a wallet signature. No gas, no on-chain transaction. Your signed intent is stored off-chain until matched.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora flex-shrink-0 mt-0.5">{icons.bolt}</div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Automated Settlement</h4>
                  <p className="text-dust text-sm leading-relaxed">When a borrower&apos;s order is matched by a lender&apos;s offer, the relayer bot calls <span className="font-mono text-xs text-star">settle()</span> on-chain with both signatures.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-nebula/10 flex items-center justify-center text-nebula flex-shrink-0 mt-0.5">{icons.coins}</div>
                <div>
                  <h4 className="text-chalk text-sm font-semibold mb-1">Permissionless Relayers</h4>
                  <p className="text-dust text-sm leading-relaxed">Anyone can call <span className="font-mono text-xs text-star">settle()</span> and earn 5 BPS (0.05%) per settlement. No permissions needed -- just a StarkNet wallet and some gas.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual: off-chain flow */}
          <div className="bg-abyss/60 border border-edge/30 rounded-[40px] p-8 sm:p-10 relative overflow-hidden granite-noise">
            <div className="absolute inset-0 bg-gradient-to-br from-star/3 to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <div className="text-center">
                <span className="text-[9px] text-ash uppercase tracking-[0.2em] font-bold">Off-Chain Flow</span>
              </div>

              {/* Borrower signs */}
              <div className="flex items-center gap-4 bg-void/40 rounded-2xl p-4 border border-edge/20">
                <div className="w-8 h-8 rounded-lg bg-star/10 flex items-center justify-center text-star text-xs font-display">B</div>
                <div className="flex-1">
                  <div className="text-[10px] text-ash uppercase tracking-widest font-bold">Borrower</div>
                  <div className="text-chalk text-xs">Signs InscriptionOrder (SNIP-12)</div>
                </div>
                <div className="text-[9px] text-aurora font-mono uppercase tracking-wider">Free</div>
              </div>

              <div className="flex justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-edge/40 to-star/20" />
              </div>

              {/* Stored off-chain */}
              <div className="flex items-center gap-4 bg-void/40 rounded-2xl p-4 border border-edge/20">
                <div className="w-8 h-8 rounded-lg bg-nebula/10 flex items-center justify-center text-nebula text-xs font-display">D</div>
                <div className="flex-1">
                  <div className="text-[10px] text-ash uppercase tracking-widest font-bold">Database</div>
                  <div className="text-chalk text-xs">Order stored in D1 (Cloudflare)</div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-edge/40 to-star/20" />
              </div>

              {/* Lender signs */}
              <div className="flex items-center gap-4 bg-void/40 rounded-2xl p-4 border border-edge/20">
                <div className="w-8 h-8 rounded-lg bg-aurora/10 flex items-center justify-center text-aurora text-xs font-display">L</div>
                <div className="flex-1">
                  <div className="text-[10px] text-ash uppercase tracking-widest font-bold">Lender</div>
                  <div className="text-chalk text-xs">Signs LendOffer (SNIP-12)</div>
                </div>
                <div className="text-[9px] text-aurora font-mono uppercase tracking-wider">Free</div>
              </div>

              <div className="flex justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-star/20 to-star/40" />
              </div>

              {/* Bot settles */}
              <div className="flex items-center gap-4 bg-star/5 rounded-2xl p-4 border border-star/20">
                <div className="w-8 h-8 rounded-lg bg-star/15 flex items-center justify-center text-star text-xs font-display">{icons.send}</div>
                <div className="flex-1">
                  <div className="text-[10px] text-star uppercase tracking-widest font-bold">Bot Settles On-Chain</div>
                  <div className="text-chalk text-xs">Calls <span className="font-mono text-star">settle()</span> with both signatures</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Privacy Pool ──────────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>Privacy Pool</SectionLabel>
          <SectionTitle>
            Lend <span className="text-nebula italic">anonymously</span>
          </SectionTitle>
          <p className="text-dust mt-6 max-w-3xl mx-auto leading-relaxed">
            Lenders shouldn&apos;t have to reveal their full portfolio to provide liquidity.
            Stela&apos;s Privacy Pool lets you lend and redeem without linking your identity
            to specific positions -- while remaining fully compliant.
          </p>
        </div>

        {/* Public vs Private paths */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Public path */}
          <div className="bg-surface/20 border border-edge/20 rounded-[32px] p-8 relative overflow-hidden granite-noise">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-chalk/5 border border-edge/30 flex items-center justify-center text-chalk">{icons.eye}</div>
              <div>
                <h3 className="font-display text-lg text-chalk uppercase tracking-wider">Public Path</h3>
                <p className="text-[10px] text-ash uppercase tracking-widest">Standard lending</p>
              </div>
            </div>
            <div className="space-y-4 text-sm text-dust leading-relaxed">
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-chalk/30 mt-2 flex-shrink-0" />
                <p>Lender signs and provides debt assets</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-chalk/30 mt-2 flex-shrink-0" />
                <p>ERC1155 shares minted directly to lender&apos;s address</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-chalk/30 mt-2 flex-shrink-0" />
                <p>Redeem shares from lender&apos;s address (publicly visible)</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-void/40 rounded-xl border border-edge/15 text-xs text-ash">
              Anyone can see which address lent to which inscription, and the exact amount.
            </div>
          </div>

          {/* Private path */}
          <div className="bg-nebula/5 border border-nebula/20 rounded-[32px] p-8 relative overflow-hidden granite-noise">
            <div className="absolute top-4 right-4 w-20 h-20 bg-nebula/5 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-nebula/10 border border-nebula/30 flex items-center justify-center text-nebula">{icons.eyeOff}</div>
              <div>
                <h3 className="font-display text-lg text-nebula uppercase tracking-wider">Private Path</h3>
                <p className="text-[10px] text-ash uppercase tracking-widest">Shielded lending</p>
              </div>
            </div>
            <div className="space-y-4 text-sm text-dust leading-relaxed relative z-10">
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nebula/40 mt-2 flex-shrink-0" />
                <p>Lender provides a <span className="text-chalk">commitment hash</span> with their offer</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nebula/40 mt-2 flex-shrink-0" />
                <p>Shares committed to <span className="text-nebula">Merkle tree</span> (not minted to address)</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-nebula/40 mt-2 flex-shrink-0" />
                <p>Redeem with <span className="text-nebula">ZK proof</span> -- no link to original lender</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-void/40 rounded-xl border border-nebula/15 text-xs text-nebula/80">
              The connection between lender identity and lending position is broken cryptographically.
            </div>
          </div>
        </div>

        {/* Privacy mechanism deep-dive */}
        <div className="bg-void/40 border border-edge/20 rounded-[40px] p-8 sm:p-12 relative overflow-hidden">
          <h3 className="font-display text-xl sm:text-2xl text-chalk uppercase tracking-wider mb-10 text-center">How Privacy Works</h3>

          <div className="grid md:grid-cols-4 gap-6 lg:gap-8">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-star/10 border border-star/20 flex items-center justify-center text-star mx-auto">
                {icons.lock}
              </div>
              <h4 className="font-display text-sm text-chalk uppercase tracking-widest">1. Commit</h4>
              <p className="text-dust text-xs leading-relaxed">
                Lender generates a secret <span className="text-chalk font-mono text-[11px]">salt</span> and computes a <span className="text-star">commitment</span> = Poseidon(inscription_id, shares, salt). This commitment is submitted with the lend offer.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-nebula/10 border border-nebula/20 flex items-center justify-center text-nebula mx-auto">
                {icons.tree}
              </div>
              <h4 className="font-display text-sm text-chalk uppercase tracking-widest">2. Insert</h4>
              <p className="text-dust text-xs leading-relaxed">
                On settlement, the commitment is inserted into a <span className="text-nebula">Merkle tree</span> (depth 16, up to 65,536 leaves). Poseidon hash function ensures efficient ZK-circuit compatibility.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cosmic/10 border border-cosmic/20 flex items-center justify-center text-cosmic mx-auto">
                {icons.hash}
              </div>
              <h4 className="font-display text-sm text-chalk uppercase tracking-widest">3. Nullify</h4>
              <p className="text-dust text-xs leading-relaxed">
                To redeem, the lender generates a <span className="text-cosmic">nullifier</span> = Poseidon(commitment, salt). The nullifier prevents double-spending without revealing which commitment is being spent.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-aurora/10 border border-aurora/20 flex items-center justify-center text-aurora mx-auto">
                {icons.checkCircle}
              </div>
              <h4 className="font-display text-sm text-chalk uppercase tracking-widest">4. Redeem</h4>
              <p className="text-dust text-xs leading-relaxed">
                Present a <span className="text-aurora">ZK proof</span> that you know the secret behind a valid commitment in the tree. Assets are sent to any address you choose. No link to the original lender.
              </p>
            </div>
          </div>

          {/* Tree visualization */}
          <div className="mt-12 pt-8 border-t border-edge/15">
            <div className="text-center mb-6">
              <span className="text-[10px] text-ash uppercase tracking-[0.2em] font-bold">Commitment Tree</span>
            </div>
            <div className="flex flex-col items-center gap-1 max-w-md mx-auto">
              {/* Root */}
              <div className="w-16 h-8 rounded-lg bg-star/10 border border-star/30 flex items-center justify-center">
                <span className="text-[8px] text-star font-mono uppercase tracking-wider">Root</span>
              </div>
              <div className="flex gap-12">
                <div className="w-px h-4 bg-edge/30" />
                <div className="w-px h-4 bg-edge/30" />
              </div>
              {/* Level 1 */}
              <div className="flex gap-8">
                <div className="w-12 h-6 rounded-md bg-nebula/8 border border-nebula/20 flex items-center justify-center">
                  <span className="text-[7px] text-nebula/60 font-mono">H(a,b)</span>
                </div>
                <div className="w-12 h-6 rounded-md bg-nebula/8 border border-nebula/20 flex items-center justify-center">
                  <span className="text-[7px] text-nebula/60 font-mono">H(c,d)</span>
                </div>
              </div>
              <div className="flex gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-px h-3 bg-edge/20" />
                ))}
              </div>
              {/* Leaves */}
              <div className="flex gap-2">
                {['C1', 'C2', 'C3', 'C4'].map((label) => (
                  <div key={label} className="w-10 h-5 rounded bg-surface/40 border border-edge/20 flex items-center justify-center">
                    <span className="text-[7px] text-dust font-mono">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-ash mt-4 text-center">
                Depth 16 &middot; 65,536 leaf capacity &middot; 100 root history &middot; Poseidon hashes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Regulatory Compliance ─────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <SectionLabel>Compliance</SectionLabel>
            <SectionTitle className="mb-6">
              Privacy is not about <span className="text-nova italic">hiding</span>
            </SectionTitle>
            <p className="text-dust leading-relaxed mb-6">
              It&apos;s about choosing what to reveal. Stela&apos;s Privacy Pool is designed from the ground up
              to be compatible with regulatory requirements. Privacy and compliance are not at odds --
              they are complementary.
            </p>
            <blockquote className="border-l-2 border-star/40 pl-6 my-8">
              <p className="text-chalk italic text-lg leading-relaxed font-display">
                &ldquo;Prove what you are not, without revealing what you are.&rdquo;
              </p>
            </blockquote>
            <p className="text-dust leading-relaxed text-sm">
              On mainnet, the protocol enforces innocence proofs and standby periods for all
              private redemptions. This ensures that shielded funds can be verified as compliant
              without compromising the privacy of legitimate users.
            </p>
          </div>

          <div className="space-y-6">
            {/* Innocence Proofs */}
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora">{icons.shield}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">Innocence Proofs</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                Before redeeming, users prove their commitment is <span className="text-aurora">NOT</span> in a
                blacklist set -- without revealing which commitment is theirs. This is a ZK
                exclusion proof: &ldquo;I am not a bad actor&rdquo; verified cryptographically.
              </p>
            </div>

            {/* Standby Period */}
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-star/10 flex items-center justify-center text-star">{icons.clock}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">Standby Period</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                A configurable time window between commitment insertion and redemption. This allows
                time for compliance verification and blacklist updates before funds can be withdrawn.
              </p>
            </div>

            {/* Blacklist Root */}
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-nova/10 flex items-center justify-center text-nova">{icons.scale}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">Blacklist Root</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                A protocol-level Merkle root hash representing known illicit addresses, updated by
                governance. Innocence proofs verify against this root. If your commitment is not
                derived from a blacklisted address, your proof passes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Genesis NFT ──────────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>Genesis Collection</SectionLabel>
          <SectionTitle>
            Own a piece of the <span className="text-star italic">protocol</span>
          </SectionTitle>
          <p className="text-dust mt-6 max-w-3xl mx-auto leading-relaxed">
            500 Genesis NFTs. Each one entitles its holder to a perpetual share of all protocol fees.
            Real yield, paid in the same tokens flowing through Stela -- not inflationary emissions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Genesis details */}
          <div className="bg-star/[0.03] border border-star/20 rounded-[32px] p-8 sm:p-10 relative overflow-hidden granite-noise">
            <div className="absolute top-4 right-4 w-24 h-24 bg-star/5 rounded-full blur-[50px] pointer-events-none" />
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-star/10 border border-star/30 flex items-center justify-center text-star">{icons.shield}</div>
              <div>
                <h3 className="font-display text-xl text-star uppercase tracking-wider">Genesis NFT</h3>
                <p className="text-[10px] text-ash uppercase tracking-widest">ERC721 on StarkNet</p>
              </div>
            </div>

            <div className="space-y-5 relative z-10">
              <div className="flex justify-between items-center py-3 border-b border-edge/15">
                <span className="text-dust text-sm">Total Supply</span>
                <span className="text-chalk font-display text-lg tracking-wider">500</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-edge/15">
                <span className="text-dust text-sm">Mint Price</span>
                <span className="text-star font-display text-lg tracking-wider">5,000 STRK</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-edge/15">
                <span className="text-dust text-sm">Fee Share</span>
                <span className="text-chalk font-display text-lg tracking-wider">100% of non-relayer fees</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-edge/15">
                <span className="text-dust text-sm">Claim</span>
                <span className="text-chalk font-display text-sm tracking-wider">Anytime, any token</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-dust text-sm">Transferable</span>
                <span className="text-aurora font-display text-sm tracking-wider">Yes -- unclaimed fees travel with NFT</span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-6">
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-star/10 flex items-center justify-center text-star">{icons.coins}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">Real Yield</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                Genesis holders earn actual ERC20 tokens from every settlement and redemption on the protocol.
                No token inflation. No dilution. Revenue flows directly from borrowers and lenders to the FeeVault,
                claimable by NFT holders at any time.
              </p>
            </div>

            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-nebula/10 flex items-center justify-center text-nebula">{icons.vault}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">FeeVault</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                A cumulative reward-per-token contract inspired by GMX and Synthetix. Each of the 500 NFTs has
                equal weight. Multiple ERC20 fee tokens are tracked independently. Claim individually or batch-claim
                across multiple NFTs in a single transaction.
              </p>
            </div>

            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise relative overflow-hidden group hover:border-star/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora">{icons.scale}</div>
                <h4 className="font-display text-base text-chalk uppercase tracking-wider">No Staking Required</h4>
              </div>
              <p className="text-dust text-sm leading-relaxed relative z-10">
                Unlike GMX or BendDAO, Genesis holders do not need to lock or stake their NFTs.
                Ownership is checked at claim time. Sell the NFT and all unclaimed rewards transfer
                to the new owner -- making each Genesis NFT inherently valuable.
              </p>
            </div>
          </div>
        </div>

        {/* Transparency card */}
        <div className="mt-8 bg-surface/20 border border-edge/20 rounded-3xl p-6 sm:p-8 granite-noise">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-chalk/10 flex items-center justify-center text-chalk">{icons.eye}</div>
            <h4 className="font-display text-base text-chalk uppercase tracking-wider">Transparent &amp; Immutable</h4>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h5 className="font-display text-sm text-chalk uppercase tracking-wider mb-2">Treasury Reserve</h5>
              <p className="text-dust text-sm leading-relaxed">
                100 of the 500 Genesis NFTs are minted to the protocol treasury on contract deployment —
                hardcoded in the smart contract constructor, not an admin action. These 100 NFTs fund
                protocol development: audits, upgrades, and licensing.
              </p>
            </div>
            <div>
              <h5 className="font-display text-sm text-chalk uppercase tracking-wider mb-2">Per-Wallet Cap</h5>
              <p className="text-dust text-sm leading-relaxed">
                Public minting is limited to 5 NFTs per wallet to prevent concentration.
                No single participant can accumulate an outsized share of protocol revenue.
              </p>
            </div>
            <div>
              <h5 className="font-display text-sm text-chalk uppercase tracking-wider mb-2">Ownership Renounced</h5>
              <p className="text-dust text-sm leading-relaxed">
                After deployment, contract ownership is renounced — no admin can mint more, change
                the price, pause minting, or alter any parameter. The contract becomes fully
                autonomous and immutable.
              </p>
            </div>
            <div>
              <h5 className="font-display text-sm text-chalk uppercase tracking-wider mb-2">Fair Fee Distribution</h5>
              <p className="text-dust text-sm leading-relaxed">
                Each NFT only earns fees deposited after it was minted. A snapshot at mint time
                prevents new holders from claiming retroactive fees. Treasury NFTs (minted at deploy)
                earn from the first deposit; public minters earn from their mint onwards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Fee Structure ──────────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>Fees</SectionLabel>
          <SectionTitle>
            Transparent and <span className="text-star italic">minimal</span>
          </SectionTitle>
          <p className="text-dust mt-6 max-w-3xl mx-auto leading-relaxed">
            0.35% total round-trip cost. Cheaper than Aave (50-100 BPS) and Compound.
            Every basis point is accounted for and routed on-chain.
          </p>
        </div>

        <div className="bg-void/40 border border-edge/20 rounded-[40px] p-8 sm:p-12 relative overflow-hidden granite-noise">
          {/* Fee table */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Settlement */}
            <div className="bg-star/[0.03] border border-star/20 rounded-3xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-star/10 border border-star/20 flex items-center justify-center text-star mx-auto mb-4">{icons.send}</div>
              <h4 className="font-display text-lg text-star uppercase tracking-widest mb-2">Settlement</h4>
              <div className="text-3xl font-display text-chalk mb-4">25 <span className="text-base text-dust">BPS</span></div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between px-2">
                  <span className="text-dust">Relayer</span>
                  <span className="text-chalk">5 BPS</span>
                </div>
                <div className="flex justify-between px-2">
                  <span className="text-dust">Genesis Holders</span>
                  <span className="text-star">20 BPS</span>
                </div>
              </div>
            </div>

            {/* Redemption */}
            <div className="bg-aurora/[0.03] border border-aurora/20 rounded-3xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-aurora/10 border border-aurora/20 flex items-center justify-center text-aurora mx-auto mb-4">{icons.checkCircle}</div>
              <h4 className="font-display text-lg text-aurora uppercase tracking-widest mb-2">Redemption</h4>
              <div className="text-3xl font-display text-chalk mb-4">10 <span className="text-base text-dust">BPS</span></div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between px-2">
                  <span className="text-dust">Relayer</span>
                  <span className="text-chalk">0 BPS</span>
                </div>
                <div className="flex justify-between px-2">
                  <span className="text-dust">Genesis Holders</span>
                  <span className="text-star">10 BPS</span>
                </div>
              </div>
            </div>

            {/* Liquidation */}
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-nova/10 border border-nova/20 flex items-center justify-center text-nova mx-auto mb-4">{icons.clock}</div>
              <h4 className="font-display text-lg text-nova uppercase tracking-widest mb-2">Liquidation</h4>
              <div className="text-3xl font-display text-chalk mb-4">0 <span className="text-base text-dust">BPS</span></div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between px-2">
                  <span className="text-dust">Relayer</span>
                  <span className="text-chalk">0 BPS</span>
                </div>
                <div className="flex justify-between px-2">
                  <span className="text-dust">Genesis Holders</span>
                  <span className="text-chalk">0 BPS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary callouts */}
          <div className="grid sm:grid-cols-3 gap-4 pt-8 border-t border-edge/15">
            <div className="text-center p-4">
              <div className="text-2xl font-display text-star mb-1">0.35%</div>
              <p className="text-[11px] text-dust uppercase tracking-widest">Total Round-Trip</p>
            </div>
            <div className="text-center p-4">
              <div className="text-2xl font-display text-star mb-1">100%</div>
              <p className="text-[11px] text-dust uppercase tracking-widest">Non-Relayer Fees to Genesis</p>
            </div>
            <div className="text-center p-4">
              <div className="text-2xl font-display text-chalk mb-1">Permissionless</div>
              <p className="text-[11px] text-dust uppercase tracking-widest">Anyone Can Relay</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Key Features Grid ────────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>Features</SectionLabel>
          <SectionTitle>
            Built for <span className="text-star italic">permanence</span>
          </SectionTitle>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={icons.grid}
            title="Multi-Asset Support"
            description="Collateral, debt, and interest can be any combination of ERC20, ERC721, ERC1155, and ERC4626 vault tokens."
            accent="star"
          />
          <FeatureCard
            icon={icons.vault}
            title="Collateral Lockers"
            description="Each inscription deploys a dedicated Locker contract. Your collateral is never pooled with others -- absolute isolation."
            accent="ember"
          />
          <FeatureCard
            icon={icons.layers}
            title="ERC1155 Shares"
            description="Every lending position is a transferable ERC1155 token. Shares represent your claim and can be traded or redeemed."
            accent="nebula"
          />
          <FeatureCard
            icon={icons.users}
            title="Multi-Lender Mode"
            description="Inscriptions can be crowdfunded by multiple lenders. Each provides a percentage of the total debt in basis points."
            accent="cosmic"
          />
          <FeatureCard
            icon={icons.shield}
            title="Oracle-Free"
            description="No price feeds, no liquidation cascades. Stela uses time-based expiry only. If the clock runs out, the collateral is forfeit."
            accent="aurora"
          />
          <FeatureCard
            icon={icons.clock}
            title="Time-Based Liquidation"
            description="Simple, predictable, and manipulation-resistant. The borrower has until the duration expires to repay. No surprises."
            accent="nova"
          />
          <FeatureCard
            icon={icons.shield}
            title="Genesis NFTs"
            description="500 NFTs, each earning a perpetual share of protocol fees. Real yield from actual lending activity, claimable at any time."
            accent="star"
          />
          <FeatureCard
            icon={icons.send}
            title="Permissionless Relayers"
            description="Anyone can settle matched orders on-chain and earn 5 BPS per trade. No whitelist, no permission -- just a wallet and gas."
            accent="ember"
          />
        </div>
      </section>

      {/* ── 10. Architecture Overview ────────────────────────── */}
      <section className="px-4 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <SectionLabel>Architecture</SectionLabel>
          <SectionTitle>
            The <span className="text-star italic">stack</span>
          </SectionTitle>
          <p className="text-dust mt-6 max-w-2xl mx-auto leading-relaxed">
            A fully on-chain protocol with off-chain indexing for discovery.
            All state transitions happen through direct smart contract interactions.
          </p>
        </div>

        <div className="bg-void/40 border border-edge/20 rounded-[40px] p-8 sm:p-12 relative overflow-hidden granite-noise">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Core stack */}
            <div className="md:col-span-3 grid md:grid-cols-3 gap-6">
              <div className="bg-abyss/60 border border-star/20 rounded-3xl p-6 text-center group hover:border-star/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-star/10 flex items-center justify-center text-star mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                </div>
                <h4 className="font-display text-sm text-star uppercase tracking-widest mb-2">Smart Contracts</h4>
                <p className="text-[11px] text-dust leading-relaxed">Cairo on StarkNet. Inscription state machine, locker deployment, share minting, privacy pool, Genesis NFT, and FeeVault.</p>
                <div className="mt-3 font-mono text-[10px] text-ash">Cairo</div>
              </div>

              <div className="bg-abyss/60 border border-edge/30 rounded-3xl p-6 text-center group hover:border-star/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-nebula/10 flex items-center justify-center text-nebula mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <h4 className="font-display text-sm text-chalk uppercase tracking-widest mb-2">TypeScript SDK</h4>
                <p className="text-[11px] text-dust leading-relaxed">Build calldata, query state, compute status, privacy utilities. Works in browser and Node.js.</p>
                <div className="mt-3 font-mono text-[10px] text-ash">@fepvenancio/stela-sdk</div>
              </div>

              <div className="bg-abyss/60 border border-edge/30 rounded-3xl p-6 text-center group hover:border-star/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-aurora/10 flex items-center justify-center text-aurora mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                </div>
                <h4 className="font-display text-sm text-chalk uppercase tracking-widest mb-2">Frontend</h4>
                <p className="text-[11px] text-dust leading-relaxed">Next.js on Cloudflare. Server-rendered UI, D1 database, direct wallet interaction for writes.</p>
                <div className="mt-3 font-mono text-[10px] text-ash">Next.js + Cloudflare</div>
              </div>
            </div>

            {/* Supporting services */}
            <div className="md:col-span-3 grid md:grid-cols-2 gap-6">
              <div className="bg-surface/20 border border-edge/20 rounded-2xl p-5 flex items-start gap-4 group hover:border-star/20 transition-all">
                <div className="w-8 h-8 rounded-lg bg-surface/50 border border-edge/30 flex items-center justify-center text-dust flex-shrink-0 group-hover:text-star transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <div>
                  <h4 className="text-chalk text-xs font-semibold mb-1">Indexer</h4>
                  <p className="text-[11px] text-dust leading-relaxed">Apibara DNA streams events from StarkNet. Webhook receiver writes to D1 for fast queries and browsing.</p>
                </div>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-2xl p-5 flex items-start gap-4 group hover:border-star/20 transition-all">
                <div className="w-8 h-8 rounded-lg bg-surface/50 border border-edge/30 flex items-center justify-center text-dust flex-shrink-0 group-hover:text-star transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                </div>
                <div>
                  <h4 className="text-chalk text-xs font-semibold mb-1">Bot Worker</h4>
                  <p className="text-[11px] text-dust leading-relaxed">Cloudflare cron job. Settles matched off-chain orders, liquidates expired inscriptions, expires stale orders.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. Final CTA ────────────────────────────────────── */}
      <section className="text-center py-20 relative px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-star/10 rounded-full blur-[100px] -z-10" />
        <Divider />
        <h2 className="font-display text-4xl md:text-5xl text-chalk my-10 italic tracking-tight">
          Ready to make your mark?
        </h2>
        <p className="text-dust mb-10 max-w-lg mx-auto leading-relaxed">
          Join the protocol built for permanence. Create lending inscriptions,
          provide liquidity, mint a Genesis NFT for perpetual fee share,
          or explore existing positions on StarkNet.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-14 h-16 rounded-full text-xl shadow-[0_0_40px_rgba(232,168,37,0.5)] transition-all hover:scale-105 active:scale-95">
            <Link href="/browse">Explore the Stelas</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-edge hover:bg-surface text-chalk px-14 h-16 rounded-full text-xl transition-all hover:border-star/30">
            <Link href="/create">Inscribe Now</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
