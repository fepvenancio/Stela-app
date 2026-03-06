import Link from 'next/link'
import { CONTRACT_ADDRESS, NETWORK } from '@/lib/config'

const GITHUB_LINKS = {
  protocol: 'https://github.com/fepvenancio/Stela',
  app: 'https://github.com/fepvenancio/stela-app',
  sdk: 'https://github.com/fepvenancio/stela-sdk-ts',
  relayer: 'https://github.com/fepvenancio/stela-relayer',
}

const DOCS_LINKS = {
  protocol: `${GITHUB_LINKS.protocol}/tree/main/docs`,
  sdk: `${GITHUB_LINKS.sdk}/tree/main/docs`,
  app: `${GITHUB_LINKS.app}/tree/main/docs`,
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
    <div className="flex gap-8 group items-start">
      <div className="flex-shrink-0 w-16 h-16 rounded-[20px] bg-abyss border border-edge/50 flex items-center justify-center text-star font-display text-2xl group-hover:border-star/50 transition-all shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-star/5 to-transparent pointer-events-none" />
        {numeral}
      </div>
      <div className="pt-3">
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
      <span className="text-[10px] text-dust uppercase tracking-[0.2em] block mb-3 font-bold">{label}</span>
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

function DocsRepoCard({ title, description, href, icon, files }: { title: string; description: string; href: string; icon: React.ReactNode; files: string[] }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-abyss/50 border border-edge/30 hover:border-star/40 rounded-3xl p-8 transition-all relative overflow-hidden granite-noise"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-star/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="w-12 h-12 rounded-2xl bg-void border border-edge/50 flex items-center justify-center text-star group-hover:border-star/40 transition-all shadow-lg shadow-black/30">
            {icon}
          </div>
          <svg className="w-4 h-4 text-ash group-hover:text-star transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
        <h4 className="font-display text-chalk text-sm uppercase tracking-widest mb-2 group-hover:text-star transition-colors">{title}</h4>
        <p className="text-dust text-xs leading-relaxed mb-5">{description}</p>
        <div className="space-y-1.5">
          {files.map(file => (
            <div key={file} className="flex items-center gap-2 text-[10px] text-ash group-hover:text-dust transition-colors">
              <div className="w-1 h-1 bg-star/40 rounded-full flex-shrink-0" />
              <span className="font-mono tracking-wide">{file}</span>
            </div>
          ))}
        </div>
      </div>
    </a>
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
          Ancient logic meeting modern validity rollups. Everything you need to understand,
          integrate, and master the Stela P2P lending protocol.
        </p>
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-star/50 to-transparent mx-auto mt-12" />
      </div>

      <div className="space-y-32">
        {/* Decentralized Protocol */}
        <section className="relative">
          <SectionHeading>Decentralized Protocol</SectionHeading>

          {/* Permissionless Protocol */}
          <div className="mb-16">
            <SubHeading>Permissionless Protocol</SubHeading>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">No Admin</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Ownership has been <span className="text-chalk font-medium">permanently renounced</span> on all deployed contracts. There is no multisig, no governance, no backdoor.
                </p>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">No Upgrades</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Contracts are <span className="text-chalk font-medium">immutable</span>. No pause function, no proxy pattern, no parameter changes. The code is the protocol.
                </p>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">Open Access</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Every protocol function — <span className="text-chalk font-medium">settle, liquidate, redeem, repay, cancel</span> — is callable by anyone. No whitelists, no gatekeepers.
                </p>
              </div>
            </div>
          </div>

          {/* Run a Relayer */}
          <div className="mb-16">
            <SubHeading>Run a Relayer</SubHeading>
            <a
              href={GITHUB_LINKS.relayer}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-abyss/60 border border-star/20 hover:border-star/50 rounded-3xl p-10 transition-all relative overflow-hidden granite-noise"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-star/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-8">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-void border border-star/30 flex items-center justify-center group-hover:border-star/60 transition-all shadow-lg shadow-black/30">
                  <svg className="w-7 h-7 text-star" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-star text-lg uppercase tracking-widest mb-2 group-hover:text-star-bright transition-colors">
                    Earn by Running a Relayer
                  </h4>
                  <p className="text-dust text-sm leading-relaxed mb-3">
                    Anyone can run a relayer bot to settle matched lending orders on-chain. Relayers earn <span className="text-chalk font-semibold">0.05%</span> of each debt asset on every successful settlement.
                  </p>
                  <span className="inline-flex items-center gap-2 text-xs text-star font-display uppercase tracking-widest">
                    View on GitHub
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          </div>

          {/* Fee Structure */}
          <div>
            <SubHeading>Fee Structure</SubHeading>
            <div className="bg-surface/20 border border-edge/20 rounded-3xl overflow-hidden granite-noise">
              <div className="grid grid-cols-4 gap-px bg-edge/10">
                <div className="bg-abyss/60 p-5">
                  <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Event</span>
                </div>
                <div className="bg-abyss/60 p-5 text-center">
                  <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Total</span>
                </div>
                <div className="bg-abyss/60 p-5 text-center">
                  <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Relayer</span>
                </div>
                <div className="bg-abyss/60 p-5 text-center">
                  <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold">Treasury</span>
                </div>
              </div>
              {/* Settlement (Lending) */}
              <div className="grid grid-cols-4 gap-px bg-edge/10">
                <div className="bg-surface/10 p-5">
                  <span className="text-sm text-chalk font-display uppercase tracking-widest">Settlement (Lending)</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-star font-semibold">0.20%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0.05%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0.15%</span>
                </div>
              </div>
              {/* Swap */}
              <div className="grid grid-cols-4 gap-px bg-edge/10">
                <div className="bg-surface/10 p-5">
                  <span className="text-sm text-chalk font-display uppercase tracking-widest">Swap</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-star font-semibold">0.10%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0.05%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0.05%</span>
                </div>
              </div>
              {/* Redemption */}
              <div className="grid grid-cols-4 gap-px bg-edge/10">
                <div className="bg-surface/10 p-5">
                  <span className="text-sm text-chalk font-display uppercase tracking-widest">Redemption</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-star font-semibold">0.10%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0.10%</span>
                </div>
              </div>
              {/* Liquidation */}
              <div className="grid grid-cols-4 gap-px bg-edge/10">
                <div className="bg-surface/10 p-5">
                  <span className="text-sm text-chalk font-display uppercase tracking-widest">Liquidation</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-star font-semibold">0%</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0</span>
                </div>
                <div className="bg-surface/10 p-5 text-center">
                  <span className="text-sm text-dust">0</span>
                </div>
              </div>
            </div>
            <p className="text-dust text-xs mt-4 leading-relaxed">
              All fees are hardcoded in the immutable contract. Non-relayer fees go to the protocol treasury. Genesis NFT holders receive automatic fee discounts (15% base + volume tiers + multi-NFT bonus, up to 50%) on settle and redeem operations.
            </p>
          </div>

          {/* Treasury & Governance */}
          <div>
            <SubHeading>Treasury & Governance</SubHeading>
            <div className="space-y-6">
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">Treasury Reserve</h4>
                <p className="text-dust text-sm leading-relaxed">
                  <span className="text-chalk font-semibold">50 of 300</span> Genesis NFTs are minted to the protocol treasury at contract deployment. This is hardcoded in the constructor — not an admin action that can be changed later. Treasury NFTs are held for protocol development: <span className="text-chalk font-medium">security audits, contract upgrades, and licensing</span>.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                  <h4 className="font-display text-star text-lg mb-3">Per-Wallet Limit</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    Public minting is capped at <span className="text-chalk font-semibold">5 NFTs per wallet</span>, enforced on-chain via the <span className="text-chalk font-mono text-xs">MAX_PER_WALLET</span> constant. No single participant can accumulate an outsized fee discount.
                  </p>
                </div>
                <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                  <h4 className="font-display text-star text-lg mb-3">Ownership Renounced</h4>
                  <p className="text-dust text-sm leading-relaxed">
                    After deployment, contract ownership is <span className="text-chalk font-semibold">permanently renounced</span> via OpenZeppelin&apos;s <span className="text-chalk font-mono text-xs">renounce_ownership()</span>. No admin functions can ever be called again — mint price, mint status, base URI, and admin minting are all permanently locked.
                  </p>
                </div>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">NFT Fee Discounts</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Genesis NFT holders receive automatic protocol fee discounts. Holding 1+ NFT grants a <span className="text-chalk font-semibold">15% base discount</span>, plus <span className="text-chalk font-semibold">+5% per volume tier</span> (7 tiers from $10K to $1M+) and <span className="text-chalk font-semibold">+2% per additional NFT</span>, capped at <span className="text-chalk font-semibold">50% off</span>. Discounts apply to the treasury portion of fees only — the 0.05% relayer fee is never discounted. Applied on-chain by reading the holder&apos;s NFT balance — no claiming or staking required. Treasury NFTs (IDs 1-50) are held by the protocol. Public minters (IDs 51-300) purchase at 1,000 STRK each.
                </p>
              </div>
              <div className="bg-abyss/60 border border-star/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">Immutable Parameters</h4>
                <p className="text-dust text-sm leading-relaxed mb-4">
                  After ownership is renounced, the following parameters are permanent and can never be modified by anyone:
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    { label: 'Mint Price', value: '1,000 STRK' },
                    { label: 'Mint Enabled', value: 'True' },
                    { label: 'Max Supply', value: '300' },
                    { label: 'Treasury', value: '50' },
                    { label: 'Per Wallet', value: '5' },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface/20 border border-edge/30 rounded-xl p-4 text-center min-w-[100px] flex-1 max-w-[160px]">
                      <span className="text-[10px] text-dust uppercase tracking-[0.2em] font-bold block mb-1">{item.label}</span>
                      <span className="text-sm text-chalk font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

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
                    <div className="text-[10px] text-dust uppercase tracking-widest">Signed & Sealed</div>
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
                 <ul className="grid grid-cols-2 gap-4 text-xs font-display uppercase tracking-wider text-dust">
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
                <span className="text-xs text-dust uppercase tracking-[0.2em] font-bold">Cancelled</span>
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
                <SubHeading>Percentage Precision</SubHeading>
                <p className="text-dust text-sm leading-relaxed">
                  The protocol operates with <span className="text-chalk font-mono">0.01%</span> precision (1/10,000).
                  Interest rates and multi-lender contributions are all calculated with this granularity
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

        {/* Off-Chain Signing */}
        <section>
          <SectionHeading>Off-Chain Signing</SectionHeading>
          <p className="text-dust mb-12 leading-relaxed text-lg max-w-3xl">
            Stela supports <span className="text-chalk font-semibold">gasless order creation</span> through
            SNIP-12 typed data signatures. Borrowers create orders without paying gas — a relayer bot
            settles matched orders on-chain.
          </p>

          <div className="space-y-16 max-w-4xl">
            <StepCard numeral="I" title="Sign Order (Off-Chain)">
              <p>
                The <span className="text-chalk font-medium">borrower</span> signs a
                <span className="text-star"> SNIP-12 InscriptionOrder</span> typed data message with their wallet.
                This contains all loan terms — collateral, debt, interest, duration, deadline, and a nonce for replay protection.
                No transaction is sent, so <span className="text-chalk font-semibold">no gas is paid</span>.
              </p>
              <div className="bg-surface/20 border border-edge/20 rounded-xl p-4 mt-4">
                <span className="text-[10px] text-dust uppercase tracking-widest font-bold block mb-2">SNIP-12 Typed Data</span>
                <p className="text-xs text-dust">
                  StarkNet&apos;s typed data standard (like EIP-712 on Ethereum). The wallet shows the user exactly what
                  they are signing — asset types, amounts, and terms — before they approve.
                </p>
              </div>
            </StepCard>

            <StepCard numeral="II" title="Submit Offer (Off-Chain)">
              <p>
                A <span className="text-chalk font-medium">lender</span> signs a
                <span className="text-star"> SNIP-12 LendOffer</span> specifying the order ID and the
                percentage of debt they want to provide. The signed offer is stored off-chain
                alongside the order.
              </p>
            </StepCard>

            <StepCard numeral="III" title="Bot Settlement (On-Chain)">
              <p>
                When an order is fully matched (offers total 100%), the
                <span className="text-star font-medium"> relayer bot</span> calls
                <span className="text-chalk font-mono"> settle()</span> on the Stela contract with both signatures.
                The contract verifies each signature on-chain via SNIP-12 typed data hashing, then
                executes the loan — locking collateral, transferring debt, and minting shares.
              </p>
              <div className="bg-surface/20 border border-edge/20 rounded-xl p-4 mt-4">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-dust uppercase tracking-widest font-bold text-[10px] block mb-1">Settlement Fee</span>
                    <span className="text-star font-mono">0.20% lending / 0.10% swap</span>
                  </div>
                  <div>
                    <span className="text-dust uppercase tracking-widest font-bold text-[10px] block mb-1">Fee Split</span>
                    <span className="text-chalk font-mono">0.05% relayer / 0.15% treasury (lending) or 0.05%+0.05% (swap)</span>
                  </div>
                  <div>
                    <span className="text-dust uppercase tracking-widest font-bold text-[10px] block mb-1">Replay Protection</span>
                    <span className="text-chalk font-mono">NoncesComponent</span>
                  </div>
                </div>
              </div>
            </StepCard>

            <StepCard numeral="IV" title="On-Chain Verification">
              <p>
                The <span className="text-chalk font-mono">settle()</span> entrypoint reconstructs the SNIP-12
                type hashes for both <span className="text-star">InscriptionOrder</span> and
                <span className="text-star"> LendOffer</span>, verifies signatures against the signer
                accounts, consumes nonces, and executes the inscription creation and signing atomically.
              </p>
            </StepCard>
          </div>

          {/* Order Book */}
          <div className="mt-16 mb-16">
            <SubHeading>Order Book Model</SubHeading>
            <p className="text-dust mb-8 leading-relaxed max-w-3xl">
              Borrowers can create <span className="text-chalk font-semibold">multiple orders simultaneously</span> with
              different terms — varying collateral, interest rates, or durations. This effectively creates a
              <span className="text-star"> peer-to-peer order book</span> where lenders browse and choose the
              offer that best suits them.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">Compete on Terms</h4>
                <p className="text-dust text-sm leading-relaxed">
                  Post multiple orders with different rates, collateral ratios, or durations.
                  Lenders pick the terms they prefer — the market decides which fills.
                </p>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">First Fill Wins</h4>
                <p className="text-dust text-sm leading-relaxed">
                  All orders from the same borrower share a <span className="text-chalk font-mono text-xs">nonce</span>.
                  When one settles on-chain and consumes the nonce, all sibling orders are
                  automatically expired — like <span className="text-chalk font-medium">cancel-on-fill</span> limit orders.
                </p>
              </div>
              <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 granite-noise">
                <h4 className="font-display text-star text-lg mb-3">No Double Settlement</h4>
                <p className="text-dust text-sm leading-relaxed">
                  The on-chain <span className="text-chalk font-mono text-xs">NoncesComponent</span> enforces strict
                  equality — even if multiple orders exist, only one can ever settle.
                  The contract guarantees this cryptographically.
                </p>
              </div>
            </div>
          </div>

          {/* Off-chain flow diagram */}
          <div className="bg-void/40 border border-edge/20 rounded-[40px] p-12 lg:p-16 overflow-hidden relative shadow-2xl mt-16">
            <h4 className="font-display text-xs text-dust uppercase tracking-[0.2em] text-center mb-12 font-bold">Off-Chain Settlement Flow</h4>
            <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-0 w-full">
              <StatusNode label="Borrower" description="Signs order" />
              <FlowArrow label="SNIP-12" className="hidden lg:flex" />
              <div className="lg:hidden h-6 w-px bg-star/20" />
              <StatusNode label="D1 Store" description="Off-chain" color="ash" />
              <FlowArrow label="Match" className="hidden lg:flex" />
              <div className="lg:hidden h-6 w-px bg-star/20" />
              <StatusNode label="Lender" description="Signs offer" />
              <FlowArrow label="Bot" className="hidden lg:flex" />
              <div className="lg:hidden h-6 w-px bg-star/20" />
              <StatusNode
                label="Settle"
                description="On-chain"
                color="aurora"
                icon={<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              />
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
                  <span className="text-[10px] text-dust uppercase tracking-widest block mb-2">Network ID</span>
                  <span className="text-chalk font-mono text-sm">{NETWORK === 'mainnet' ? 'SN_MAIN' : 'SN_SEPOLIA'}</span>
               </div>
               <div className="bg-void/50 border border-edge/20 rounded-2xl p-5">
                  <span className="text-[10px] text-dust uppercase tracking-widest block mb-2">Status</span>
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
                q: 'Can I create multiple orders at once?',
                a: 'Yes. You can post several orders with different terms simultaneously — like limit orders on an exchange. Lenders choose which to fund. When one settles, all others from the same nonce are automatically cancelled. Only one can ever fill.',
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

        {/* Documentation Hub */}
        <section>
          <SectionHeading>Documentation Hub</SectionHeading>
          <p className="text-dust mb-12 leading-relaxed text-lg max-w-3xl">
            Deep-dive into each component of the Stela ecosystem. Every repository maintains
            its own technical documentation covering architecture, types, flows, and security.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <DocsRepoCard
              title="Stela Contracts"
              description="Cairo smart contracts powering the protocol — inscription state machine, collateral lockers, ERC1155 shares, Genesis NFT fee discounts, and the settle() entrypoint."
              href={DOCS_LINKS.protocol}
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-star">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
              files={['ARCHITECTURE.md', 'SPEC.md', 'TYPES.md', 'EVENTS.md', 'FLOWS.md', 'SHARE-MATH.md', 'security.md', 'deployment.md']}
            />
            <DocsRepoCard
              title="TypeScript SDK"
              description="Client library for interacting with Stela programmatically — InscriptionClient, ShareClient, and off-chain signing helpers."
              href={DOCS_LINKS.sdk}
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-star">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              }
              files={['ARCHITECTURE.md', 'api-reference.md', 'TYPES.md', 'FLOWS.md', 'getting-started.md', 'security.md']}
            />
            <DocsRepoCard
              title="Stela App"
              description="Next.js frontend, Cloudflare Workers (indexer + bot), D1 database schema, API routes, and deployment guides."
              href={DOCS_LINKS.app}
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-star">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
              files={['architecture.md', 'frontend.md', 'api.md', 'workers.md', 'flows.md', 'd1-schema.md', 'deployment.md']}
            />
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
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Protocol (Contracts)', href: GITHUB_LINKS.protocol, desc: 'Cairo smart contracts' },
              { label: 'Application (Frontend)', href: GITHUB_LINKS.app, desc: 'Next.js app, indexer, bot' },
              { label: 'TypeScript SDK', href: GITHUB_LINKS.sdk, desc: 'npm: @fepvenancio/stela-sdk' },
              { label: 'Relayer', href: GITHUB_LINKS.relayer, desc: 'Standalone settlement bot' },
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
                <p className="text-dust text-xs">{desc}</p>
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
              className="bg-star hover:bg-star-bright text-void font-bold px-12 py-4 rounded-full text-lg shadow-[0_0_20px_-2px_rgba(232,168,37,0.45)] transition-all hover:scale-105"
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
