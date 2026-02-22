import Link from 'next/link'
import { CONTRACT_ADDRESS, NETWORK } from '@/lib/config'

const GITHUB_LINKS = {
  protocol: 'https://github.com/fepvenancio/Stela',
  app: 'https://github.com/fepvenancio/stela-app',
  sdk: 'https://github.com/fepvenancio/stela-sdk-ts',
}

const VOYAGER_BASE = NETWORK === 'mainnet'
  ? 'https://voyager.online/contract'
  : 'https://sepolia.voyager.online/contract'

const STARKSCAN_BASE = NETWORK === 'mainnet'
  ? 'https://starkscan.co/contract'
  : 'https://sepolia.starkscan.co/contract'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl sm:text-4xl text-star mb-8 uppercase tracking-[0.2em] border-b border-edge/30 pb-4 relative">
      {children}
      <div className="absolute -bottom-[1px] left-0 w-24 h-[1px] bg-star" />
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-lg text-chalk uppercase tracking-widest mb-4 flex items-center gap-3">
      <div className="w-1.5 h-1.5 bg-star rotate-45" />
      {children}
    </h3>
  )
}

function StepCard({ numeral, title, children }: { numeral: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-8 group">
      <div className="flex-shrink-0 w-16 h-16 rounded-[20px] bg-abyss border border-edge/50 flex items-center justify-center text-star font-display text-2xl group-hover:border-star/50 transition-all shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-star/5 to-transparent pointer-events-none" />
        {numeral}
      </div>
      <div className="pt-2">
        <h4 className="text-star font-display text-lg uppercase tracking-widest mb-3 group-hover:text-star-bright transition-colors">{title}</h4>
        <div className="text-dust text-sm leading-relaxed space-y-3 max-w-2xl">{children}</div>
      </div>
    </div>
  )
}

function InfoCard({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-surface/30 border border-edge/30 rounded-2xl p-6 relative overflow-hidden granite-noise group hover:border-star/20 transition-all">
      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-star">
          <path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" fill="currentColor" />
        </svg>
      </div>
      <span className="text-[10px] text-ash uppercase tracking-[0.2em] block mb-3 font-bold">{label}</span>
      <div className={`text-sm text-chalk leading-relaxed ${mono ? 'font-mono break-all' : ''}`}>{children}</div>
    </div>
  )
}

function StatusNode({ label, description, color = 'star', icon }: { label: string; description?: string; color?: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    star: 'text-star border-star/20',
    aurora: 'text-aurora border-aurora/20',
    nova: 'text-nova border-nova/20',
    ash: 'text-ash border-edge/40',
    chalk: 'text-chalk border-edge/40'
  }
  
  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div className={`px-4 py-2 rounded-xl border bg-abyss/40 granite-noise transition-all duration-300 flex items-center gap-2 min-w-[100px] justify-center ${colorMap[color] || colorMap.star}`}>
        {icon && <div className="opacity-70">{icon}</div>}
        <span className="font-display text-[10px] tracking-[0.15em] uppercase font-bold">{label}</span>
      </div>
      {description && <span className="text-[8px] text-ash uppercase tracking-widest font-bold opacity-60">{description}</span>}
    </div>
  )
}

function FlowArrow({ label, vertical = false, className = '' }: { label?: string; vertical?: boolean; className?: string }) {
  if (vertical) {
     return (
       <div className={`flex flex-col items-center py-2 ${className}`}>
          <div className="w-[1px] h-8 bg-gradient-to-b from-edge/40 via-star/20 to-edge/40" />
          {label && <span className="text-[7px] text-star/40 uppercase tracking-widest font-bold my-1">{label}</span>}
          <div className="w-[1px] h-8 bg-gradient-to-b from-edge/40 via-star/20 to-edge/40" />
       </div>
     )
  }
  return (
    <div className={`flex items-center gap-1 px-2 ${className}`}>
      <div className="h-[1px] w-6 sm:w-8 bg-gradient-to-r from-edge/20 via-star/30 to-edge/20" />
      {label && <span className="text-[7px] text-star/40 uppercase tracking-widest font-bold whitespace-nowrap">{label}</span>}
      <div className="h-[1px] w-6 sm:w-8 bg-gradient-to-r from-edge/20 via-star/30 to-edge/10" />
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-32">
      {/* Hero */}
      <div className="mb-24 text-center relative py-12">
        <div className="absolute inset-0 bg-star/2 blur-[120px] rounded-full -z-10" />
        <h1 className="font-display text-5xl sm:text-7xl tracking-tighter text-chalk mb-6 uppercase">
          The <span className="text-star italic">Stela</span> Codex
        </h1>
        <p className="text-dust max-w-2xl leading-relaxed text-lg mx-auto">
          Ancient logic meeting modern ZK-rollups. Everything you need to understand, 
          integrate, and master the Stela P2P lending protocol.
        </p>
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-star/50 to-transparent mx-auto mt-12" />
      </div>

      <div className="space-y-32">
        {/* Overview */}
        <section className="relative">
          <SectionHeading>What is Stela?</SectionHeading>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-dust text-base leading-relaxed">
              <p>
                Stela is a <span className="text-chalk font-semibold">sovereign lending protocol</span> on StarkNet.
                It removes the middlemen, the liquidity pools, and the centralized oracles, returning lending to its 
                purest form: a direct agreement between two parties.
              </p>
              <p>
                Every loan is a <span className="text-star italic">Stela</span> — an immutable,
                on-chain record. It is more than data; it is a digital monument to a commitment,
                carved into the StarkNet state with cryptographic certainty.
              </p>
              <p>
                By using <span className="text-chalk font-semibold">Collateral Lockers</span> and <span className="text-chalk font-semibold">ERC1155 Shares</span>, 
                Stela provides a secure, flexible, and transferable lending experience that supports everything from 
                ETH to high-value NFTs.
              </p>
            </div>
            <div className="bg-abyss/60 border border-edge/30 rounded-[40px] p-10 relative overflow-hidden granite-noise group">
               <div className="absolute inset-0 bg-gradient-to-br from-star/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <div className="space-y-6 relative z-10">
                  <div className="w-12 h-16 bg-star/10 border-x border-t border-star/30 rounded-t-lg mx-auto relative">
                     <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-star/50" />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="font-display text-star uppercase tracking-widest text-sm">Immutable Agreement</div>
                    <div className="text-[10px] text-ash uppercase tracking-widest">Signed & Sealed</div>
                  </div>
                  <div className="space-y-2">
                     {[1,2,3].map(i => (
                       <div key={i} className="h-1 bg-edge/30 rounded-full w-full" style={{ width: `${100 - i*20}%`, margin: '0 auto' }} />
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Terminology */}
        <section>
          <SectionHeading>Core Terminology</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
              <h4 className="font-display text-star text-lg mb-3">Collateral</h4>
              <p className="text-dust text-sm leading-relaxed">
                The <span className="text-chalk font-medium">Guarantee</span>. Assets provided by the borrower and locked in a secure per-inscription Locker contract. If the borrower defaults, these assets are forfeit to the lender.
              </p>
            </div>
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
              <h4 className="font-display text-star text-lg mb-3">Debt</h4>
              <p className="text-dust text-sm leading-relaxed">
                The <span className="text-chalk font-medium">Principal</span>. The exact assets and amounts the borrower wishes to receive. Lenders provide these assets to "seal" the inscription.
              </p>
            </div>
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
              <h4 className="font-display text-star text-lg mb-3">Interest</h4>
              <p className="text-dust text-sm leading-relaxed">
                The <span className="text-chalk font-medium">Reward</span>. The additional assets the borrower agrees to pay the lender on top of the debt principal upon repayment.
              </p>
            </div>
            <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
              <h4 className="font-display text-star text-lg mb-3">Deadline</h4>
              <p className="text-dust text-sm leading-relaxed">
                The <span className="text-chalk font-medium">Discovery Period</span>. A unix timestamp defining when the inscription stops accepting lenders. If reached without a signature, the inscription expires and collateral can be reclaimed.
              </p>
            </div>
          </div>
        </section>

        {/* Lifecycle */}
        <section>
          <SectionHeading>Inscription Lifecycle</SectionHeading>
          <p className="text-dust mb-16 leading-relaxed text-lg max-w-3xl">
            Each Stela progresses through a ritual of state changes. Understanding this lifecycle
            is key to mastering the protocol's mechanics.
          </p>

          <div className="space-y-16 max-w-4xl">
            <StepCard numeral="I" title="Inscribe (Open)">
              <p>
                The <span className="text-chalk font-medium">borrower</span> initiates the ritual by locking collateral into a 
                dedicated <span className="text-star">Locker Contract</span>. They define the terms: 
                debt requested, interest offered, and the duration of the lock.
              </p>
              <div className="bg-surface/20 border border-edge/20 rounded-xl p-4 mt-4">
                 <ul className="grid grid-cols-2 gap-4 text-xs font-display uppercase tracking-wider text-ash">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-star" /> Collateral</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-star" /> Debt</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-star" /> Interest</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-star" /> Deadline</li>
                 </ul>
              </div>
            </StepCard>

            <StepCard numeral="II" title="Seal (Filled)">
              <p>
                A <span className="text-chalk font-medium">lender</span> signs the inscription, providing the debt assets. 
                The borrower receives the liquidity immediately, and the lender is issued 
                <span className="text-star font-medium"> ERC1155 Shares</span> as a receipt of their claim.
              </p>
              <p className="text-xs italic">
                Repayment duration begins the moment the ritual is sealed.
              </p>
            </StepCard>

            <StepCard numeral="III" title="Repay (Repaid)">
              <p>
                To reclaim their stone and collateral, the <span className="text-chalk font-medium">borrower returns</span> the full
                debt plus interest. The Stela is settled, and the lender can redeem their shares for the 
                repaid assets.
              </p>
            </StepCard>

            <StepCard numeral="IV" title="Liquidate (Liquidated)">
              <p>
                Should the borrower <span className="text-nova font-medium uppercase tracking-widest">default</span> (fail to repay before expiry), 
                the collateral is forfeit. Lenders liquidate the Stela to claim the locked assets proportionally.
              </p>
            </StepCard>

            <StepCard numeral="V" title="Redeem">
              <p>
                Once a Stela is <span className="text-chalk">Repaid</span> or <span className="text-nova">Liquidated</span>, 
                share holders <span className="text-star font-medium uppercase tracking-widest">Redeem</span> their 
                positions to claim their portion of the assets.
              </p>
            </StepCard>
          </div>
        </section>

        {/* Other Statuses */}
        <section>
          <SectionHeading>Other States</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-abyss/40 border border-edge/30 rounded-3xl p-8 relative overflow-hidden granite-noise">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full border border-nova/30 flex items-center justify-center text-nova font-display text-sm">!</div>
                <span className="text-xs text-nova uppercase tracking-[0.2em] font-bold">Expired</span>
              </div>
              <p className="text-dust text-sm leading-relaxed">
                If the deadline passes without a signature, the inscription expires.
                No debt was ever issued, so no assets are at risk.
                The borrower can safely <span className="text-chalk">cancel and reclaim</span> their collateral.
              </p>
            </div>
            <div className="bg-abyss/40 border border-edge/30 rounded-3xl p-8 relative overflow-hidden granite-noise">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full border border-edge/30 flex items-center justify-center text-ash font-display text-sm">X</div>
                <span className="text-xs text-ash uppercase tracking-[0.2em] font-bold">Cancelled</span>
              </div>
              <p className="text-dust text-sm leading-relaxed">
                Borrowers may cancel an open inscription at any time before it is signed.
                The locker releases the collateral, and the Stela is permanently deactivated.
              </p>
            </div>
          </div>
        </section>

        {/* Status Diagram */}
        <section>
          <SectionHeading>Status Flow</SectionHeading>
          <div className="bg-void/40 border border-edge/20 rounded-[40px] p-12 lg:p-20 overflow-hidden relative shadow-2xl">
             <div className="flex flex-col items-center gap-12 relative z-10">
                {/* Primary Path */}
                <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-0 w-full">
                   <StatusNode label="Open" description="Inscription" />
                   <FlowArrow label="Sign" className="hidden lg:flex" />
                   <div className="lg:hidden h-6 w-px bg-star/20" />
                   <StatusNode label="Filled" description="Sealed" />
                   <FlowArrow label="Repay" className="hidden lg:flex" />
                   <div className="lg:hidden h-6 w-px bg-star/20" />
                   <StatusNode 
                    label="Repaid" 
                    description="Settled" 
                    color="aurora" 
                    icon={<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                   />
                   <FlowArrow label="Redeem" className="hidden lg:flex" />
                   <div className="lg:hidden h-6 w-px bg-star/20" />
                   <StatusNode 
                    label="Redeemed" 
                    description="Success" 
                    color="chalk" 
                    icon={<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" /></svg>}
                   />
                </div>

                {/* Secondary Paths */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-40">
                   <div className="flex flex-col items-center">
                      <FlowArrow label="Cancel" vertical />
                      <StatusNode label="Cancelled" description="Released" color="ash" />
                   </div>
                   <div className="flex flex-col items-center">
                      <FlowArrow label="Default" vertical />
                      <StatusNode label="Liquidated" description="Forfeit" color="nova" />
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* Key Concepts */}
        <section>
          <SectionHeading>Core Mechanics</SectionHeading>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <SubHeading>Shares (ERC1155)</SubHeading>
                <p className="text-dust text-sm leading-relaxed">
                  Stela issues <span className="text-chalk">ERC1155 Share Tokens</span> for every loan. These tokens are 
                  transferable receipts of your lending position. Whoever holds the shares at the time of 
                  settlement holds the right to claim the underlying assets.
                </p>
              </div>

              <div>
                <SubHeading>Basis Points (BPS)</SubHeading>
                <p className="text-dust text-sm leading-relaxed">
                  The protocol operates with <span className="text-chalk font-mono">1/10,000</span> precision. 
                  Interest rates and multi-lender contributions are all calculated in basis points (BPS) 
                  to ensure maximum accuracy without floating-point errors.
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <SubHeading>Multi-Lender Mode</SubHeading>
                <p className="text-dust text-sm leading-relaxed">
                  Inscriptions can be "crowdfunded." Multiple lenders can sign a single Stela, 
                  each providing a percentage of the total debt. The ritual remains 
                  <span className="text-chalk">Partial</span> until 100% of the debt is covered.
                </p>
              </div>

              <div>
                <SubHeading>Collateral Lockers</SubHeading>
                <p className="text-dust text-sm leading-relaxed">
                  Stela uses a <span className="text-chalk">Factory Pattern</span> to deploy a fresh 
                  Locker Contract for every inscription. This unique architecture ensures that 
                  your collateral is never pooled with others, providing absolute isolation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Assets */}
        <section>
          <SectionHeading>Asset Support</SectionHeading>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { type: 'ERC20', icon: 'F' },
              { type: 'ERC721', icon: 'N' },
              { type: 'ERC1155', icon: 'S' },
              { type: 'ERC4626', icon: 'V' },
            ].map(({ type, icon }) => (
              <div key={type} className="bg-surface/20 border border-edge/20 rounded-2xl p-6 text-center group hover:border-star/40 transition-all granite-noise">
                <div className="w-10 h-10 rounded-full bg-void border border-edge/50 flex items-center justify-center text-star font-display text-sm mx-auto mb-4 group-hover:scale-110 transition-transform">{icon}</div>
                <span className="font-display text-chalk text-xs tracking-widest uppercase">{type}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contract Addresses */}
        <section className="bg-surface/10 border border-edge/20 rounded-[40px] p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
             <div className="w-24 h-24 border-r-2 border-t-2 border-star/10 rounded-tr-3xl" />
          </div>
          <SectionHeading>Deployment</SectionHeading>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <p className="text-dust text-sm leading-relaxed">
                Stela is a protocol for the permanent record. Currently deployed on the 
                <span className="text-star uppercase font-bold tracking-widest px-2">{NETWORK}</span> network.
              </p>
              <InfoCard label="Core Contract" mono>
                <p className="text-star font-semibold">{CONTRACT_ADDRESS}</p>
                <div className="flex gap-4 mt-4">
                   <a href={`${VOYAGER_BASE}/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="text-[10px] text-ash hover:text-star uppercase tracking-widest font-bold underline transition-colors">Voyager</a>
                   <a href={`${STARKSCAN_BASE}/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="text-[10px] text-ash hover:text-star uppercase tracking-widest font-bold underline transition-colors">StarkScan</a>
                </div>
              </InfoCard>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-void/50 border border-edge/20 rounded-2xl p-5">
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Network ID</span>
                  <span className="text-chalk font-mono text-sm">{NETWORK === 'mainnet' ? 'SN_MAIN' : 'SN_SEPOLIA'}</span>
               </div>
               <div className="bg-void/50 border border-edge/20 rounded-2xl p-5">
                  <span className="text-[10px] text-ash uppercase tracking-widest block mb-2">Status</span>
                  <span className="text-aurora font-mono text-sm uppercase">Active</span>
               </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <SectionHeading>Knowledge Base</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                q: 'What happens if no one lends to my inscription?',
                a: 'The inscription will eventually hit its deadline and expire. No debt was ever provided, so your collateral remains safe. You can reclaim it by cancelling the expired Stela.',
              },
              {
                q: 'Can I cancel after a lender has signed?',
                a: 'No. Signature creates an immutable on-chain debt obligation. You must repay the debt plus interest within the duration to release your collateral.',
              },
              {
                q: 'Is there an oracle or price feed?',
                a: 'No. Stela is oracle-free. It does not liquidate based on price fluctuations, only on time. This eliminates oracle manipulation risks.',
              },
              {
                q: 'Are shares transferable?',
                a: 'Yes. Every lending position is an ERC1155 token. You can transfer your shares to another address, and they will hold the right to claim the assets.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-abyss/30 border border-edge/20 rounded-3xl p-8 hover:bg-abyss/50 transition-colors">
                <h4 className="font-display text-chalk text-sm tracking-widest uppercase mb-4">{q}</h4>
                <p className="text-dust text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section>
          <SectionHeading>Architecture</SectionHeading>
          <p className="text-dust mb-8 leading-relaxed">
            Stela is a fully on-chain protocol with off-chain indexing for discovery.
            All state transitions happen through direct smart contract interactions — the backend
            never proxies writes.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard label="Smart Contracts (Cairo)">
              <p className="text-dust text-sm">Core protocol logic, inscription state machine, locker deployment, share minting. Written in Cairo for StarkNet.</p>
            </InfoCard>
            <InfoCard label="Indexer (Cloudflare Worker)">
              <p className="text-dust text-sm">Polls StarkNet RPC for contract events and writes to D1 (SQLite). Enables browsing and discovery of inscriptions.</p>
            </InfoCard>
            <InfoCard label="Frontend (Next.js)">
              <p className="text-dust text-sm">Server-rendered UI deployed on Cloudflare. Reads from D1 for listing, connects directly to StarkNet for writes via user wallet.</p>
            </InfoCard>
            <InfoCard label="Liquidation Bot (Cloudflare Worker)">
              <p className="text-dust text-sm">Automated cron job that monitors for expired inscriptions and executes liquidations on-chain.</p>
            </InfoCard>
          </div>
        </section>

        {/* SDK */}
        <section>
          <SectionHeading>SDK &amp; Developer Tools</SectionHeading>
          <p className="text-dust mb-6 leading-relaxed">
            The <span className="text-chalk">@fepvenancio/stela-sdk</span> TypeScript SDK provides
            everything needed to interact with the Stela protocol programmatically.
          </p>

          <div className="bg-abyss/40 border border-edge/20 rounded-3xl p-6 space-y-4">
            <div className="font-mono text-sm">
              <span className="text-ash">$</span>{' '}
              <span className="text-chalk">npm install @fepvenancio/stela-sdk</span>
            </div>
            <div className="text-dust text-sm space-y-2">
              <p><span className="text-chalk font-mono">InscriptionClient</span> — Build transaction calldata for create, sign, repay, cancel, liquidate</p>
              <p><span className="text-chalk font-mono">ShareClient</span> — Query ERC1155 share balances and build redeem calls</p>
              <p><span className="text-chalk font-mono">LockerClient</span> — Query locker addresses and locked assets</p>
              <p><span className="text-chalk font-mono">ApiClient</span> — Fetch indexed inscription data from the API</p>
              <p><span className="text-chalk font-mono">computeStatus()</span> — Canonical status computation for any inscription</p>
            </div>
          </div>
        </section>

        {/* Links */}
        <section>
          <SectionHeading>Source Code &amp; Links</SectionHeading>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Protocol (Contracts)', href: GITHUB_LINKS.protocol, desc: 'Cairo smart contracts' },
              { label: 'Application (Frontend)', href: GITHUB_LINKS.app, desc: 'Next.js app, indexer, bot' },
              { label: 'TypeScript SDK', href: GITHUB_LINKS.sdk, desc: 'npm: @fepvenancio/stela-sdk' },
            ].map(({ label, href, desc }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-surface/20 border border-edge/20 hover:border-star/30 rounded-2xl p-5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-ash group-hover:text-star transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="text-chalk text-sm font-semibold group-hover:text-star transition-colors">{label}</span>
                </div>
                <p className="text-ash text-xs">{desc}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center py-20 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-star/10 rounded-full blur-[100px] -z-10" />
          <h2 className="font-display text-4xl text-chalk mb-10 italic">Your legacy awaits.</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="/browse"
              className="bg-star hover:bg-star-bright text-void font-bold px-12 py-4 rounded-full text-lg shadow-[0_0_40px_rgba(232,168,37,0.4)] transition-all hover:scale-105"
            >
              Explore Stelas
            </Link>
            <Link
              href="/create"
              className="border border-edge hover:bg-surface text-chalk px-12 py-4 rounded-full text-lg transition-all hover:border-star/30"
            >
              Inscribe Now
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
