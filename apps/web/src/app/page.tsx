import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-32 pb-32 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 min-h-[70vh] flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-star/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center animate-fade-up px-4 relative z-20">
          <h1 className="font-display text-6xl md:text-8xl tracking-tighter text-chalk mb-8 leading-tight">
            Inscribe Your <span className="text-star">Legacy</span>
          </h1>
          <p className="text-dust text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
            Stela is a decentralized, peer-to-peer lending protocol on StarkNet. 
            Direct, durable, and carved into the blockchain through digital inscriptions.
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

        {/* Visual Element: Floating Stelas - Adjusted to not overlap */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between px-10 md:px-20 pointer-events-none opacity-20 grayscale -z-10">
          {[1, 2].map((i) => (
            <div 
              key={i}
              className={`w-32 md:w-48 h-64 md:h-96 bg-gradient-to-b from-surface to-void border-x border-t border-edge/40 rounded-t-2xl relative overflow-hidden`}
              style={{ 
                transform: `translateY(${i % 2 === 0 ? '40px' : '80px'}) rotate(${i % 2 === 0 ? '-5deg' : '5deg'})`,
                animation: `drift ${15 + i * 5}s ease-in-out infinite alternate`
              }}
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/granite.png')] opacity-20" />
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="grid md:grid-cols-3 gap-8 relative px-4">
        <div className="absolute inset-0 bg-star/2 blur-[150px] -z-10" />
        
        <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-star/10 flex items-center justify-center text-star mb-6 group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">Immutable Records</h3>
          <p className="text-dust text-sm leading-relaxed">
            Every lending position is a unique inscription. Once carved into the Stela, it remains a durable, semi-fungible record of your commitment.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-nebula/10 flex items-center justify-center text-nebula mb-6 group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">Pure Peer-to-Peer</h3>
          <p className="text-dust text-sm leading-relaxed">
            Direct interaction between borrowers and lenders. No intermediaries, no hidden fees. Your assets, your terms, your inscription.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-aurora/10 flex items-center justify-center text-aurora mb-6 group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h3 className="font-display text-xl text-chalk mb-3 uppercase tracking-wider">StarkNet Native</h3>
          <p className="text-dust text-sm leading-relaxed">
            Built for speed and scalability. Harnessing ZK-rollups to ensure your inscriptions are secure, affordable, and permanent.
          </p>
        </div>
      </section>

      {/* The Ritual - Improved layout and text */}
      <section className="py-20 px-4">
        <div className="text-center mb-20">
          <h2 className="font-display text-4xl md:text-5xl text-chalk mb-6 italic tracking-tight">The Ritual of Lending</h2>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-star/50 to-transparent mx-auto" />
        </div>

        <div className="grid lg:grid-cols-2 gap-20 items-center max-w-6xl mx-auto">
          <div className="space-y-16">
            <div className="flex gap-8 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-2xl group-hover:border-star/50 transition-all shadow-lg">I</div>
              <div>
                <h4 className="text-chalk text-xl font-display uppercase tracking-widest mb-3 group-hover:text-star transition-colors">Inscribe the Stela</h4>
                <p className="text-dust leading-relaxed">
                  Lock your collateral into a new inscription. Define your terms—debt requested, interest offered, and the duration of the lock.
                </p>
              </div>
            </div>

            <div className="flex gap-8 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-2xl group-hover:border-star/50 transition-all shadow-lg">II</div>
              <div>
                <h4 className="text-chalk text-xl font-display uppercase tracking-widest mb-3 group-hover:text-star transition-colors">Seal the Agreement</h4>
                <p className="text-dust leading-relaxed">
                  Lenders sign your inscription to provide liquidity. Upon sealing, the <span className="text-star/80">borrower receives the assets</span> to hold for the duration of the agreement.
                </p>
              </div>
            </div>

            <div className="flex gap-8 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-surface border border-edge/50 flex items-center justify-center text-star font-display text-2xl group-hover:border-star/50 transition-all shadow-lg">III</div>
              <div>
                <h4 className="text-chalk text-xl font-display uppercase tracking-widest mb-3 group-hover:text-star transition-colors">Honor the Legacy</h4>
                <p className="text-dust leading-relaxed">
                  Repay the debt before the lock ends to reclaim your collateral. If the terms expire unpaid, the <span className="text-nova/80">lender redeems the collateral</span>, and the stone is settled.
                </p>
              </div>
            </div>
          </div>

          {/* Static Thematic Visual */}
          <div className="relative group">
            <div className="absolute inset-0 bg-star/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative aspect-[3/4] max-w-[400px] mx-auto bg-abyss border-x-2 border-t-2 border-edge/40 rounded-t-[40px] shadow-2xl p-10 flex flex-col items-center justify-center overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/granite.png')] opacity-10 pointer-events-none" />
               <div className="w-full h-full border border-star/10 rounded-t-[30px] p-8 flex flex-col gap-6">
                  <div className="flex justify-between items-center pb-6 border-b border-edge/20">
                    <div className="space-y-2">
                      <div className="w-20 h-2 bg-star/30 rounded-full" />
                      <div className="w-12 h-2 bg-star/10 rounded-full" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-star/5 border border-star/20" />
                  </div>
                  <div className="space-y-4 pt-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-3 items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-star/20" />
                        <div className="h-1.5 bg-edge/20 rounded-full flex-1" style={{ width: `${Math.random() * 60 + 40}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto pt-10 flex flex-col gap-3">
                    <div className="w-full h-10 rounded-xl bg-star/5 border border-star/10" />
                    <div className="w-2/3 h-2 bg-edge/10 rounded-full mx-auto" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center py-20 relative px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-star/10 rounded-full blur-[100px] -z-10" />
        <h2 className="font-display text-4xl md:text-5xl text-chalk mb-10 italic">Ready to make your mark?</h2>
        <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-14 h-16 rounded-full text-xl shadow-[0_0_40px_rgba(232,168,37,0.5)] transition-all hover:scale-105 active:scale-95">
          <Link href="/browse">Explore the Stelas</Link>
        </Button>
      </section>
    </div>
  )
}
