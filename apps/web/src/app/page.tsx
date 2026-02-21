import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-star/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter text-chalk mb-6 leading-tight">
            Inscribe Your <span className="text-star">Legacy</span> in Stone
          </h1>
          <p className="text-dust text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Stela is a decentralized, peer-to-peer lending protocol on StarkNet. 
            Direct, durable, and carved into the blockchain through digital inscriptions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-8 h-12 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(232,168,37,0.3)]">
              <Link href="/browse">Enter the Library</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-edge hover:bg-surface text-chalk px-8 h-12 rounded-full transition-all">
              <Link href="/create">Create Inscription</Link>
            </Button>
          </div>
        </div>

        {/* Visual Element: Floating Stelas */}
        <div className="mt-20 flex justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-700 animate-fade-in delay-300">
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-24 md:w-32 h-48 md:h-64 bg-gradient-to-b from-surface to-void border-x border-t border-edge/40 rounded-t-lg relative group overflow-hidden`}
              style={{ 
                transform: `translateY(${i % 2 === 0 ? '-20px' : '20px'})`,
                animation: `drift ${10 + i * 2}s ease-in-out infinite alternate`
              }}
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/granite.png')] opacity-20 pointer-events-none" />
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-px h-1/2 bg-gradient-to-b from-star/50 to-transparent group-hover:from-star transition-all" />
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="grid md:grid-cols-3 gap-8 relative">
        <div className="absolute inset-0 bg-star/2 blur-[150px] -z-10" />
        
        <div className="p-8 rounded-3xl bg-surface/30 border border-edge/20 backdrop-blur-sm group hover:border-star/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-star/10 flex items-center justify-center text-star mb-6 group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 className="font-display text-xl text-chalk mb-3">Immutable Records</h3>
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
          <h3 className="font-display text-xl text-chalk mb-3">Pure Peer-to-Peer</h3>
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
          <h3 className="font-display text-xl text-chalk mb-3">StarkNet Native</h3>
          <p className="text-dust text-sm leading-relaxed">
            Built for speed and scalability. Harnessing the power of ZK-rollups to ensure your inscriptions are both secure and affordable.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-12 border-y border-edge/10">
        <h2 className="font-display text-3xl text-center text-chalk mb-16">The Ritual of Lending</h2>
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-12">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full border border-star/30 flex items-center justify-center text-star font-display">1</div>
              <div>
                <h4 className="text-chalk font-semibold mb-2">Create a Stela</h4>
                <p className="text-dust text-sm">Lock your assets and define your terms. Borrow assets against your collateral in a single inscription.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full border border-star/30 flex items-center justify-center text-star font-display">2</div>
              <div>
                <h4 className="text-chalk font-semibold mb-2">Inscribe the Agreement</h4>
                <p className="text-dust text-sm">Lenders sign the inscription, providing the requested liquidity. The terms are now carved into the blockchain.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full border border-star/30 flex items-center justify-center text-star font-display">3</div>
              <div>
                <h4 className="text-chalk font-semibold mb-2">Honor the Legacy</h4>
                <p className="text-dust text-sm">Repay the loan to reclaim your collateral. Failure to honor the agreement leads to the liquidation of the stone.</p>
              </div>
            </div>
          </div>
          <div className="bg-surface/20 border border-edge/20 rounded-3xl p-8 aspect-square flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-star/5 to-transparent group-hover:opacity-100 opacity-0 transition-opacity" />
            <div className="w-48 h-72 bg-abyss border-x-2 border-t-2 border-edge rounded-t-xl relative z-10 shadow-2xl transition-transform group-hover:-translate-y-2">
               <div className="p-4 border-b border-edge/30">
                  <div className="w-12 h-1 bg-star/20 rounded-full mb-2" />
                  <div className="w-8 h-1 bg-star/10 rounded-full" />
               </div>
               <div className="p-4 space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-2">
                       <div className="w-2 h-2 rounded-full bg-star/20" />
                       <div className="flex-1 h-2 bg-edge/30 rounded-full" />
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center py-20 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-star/10 rounded-full blur-[100px] -z-10" />
        <h2 className="font-display text-4xl text-chalk mb-8 italic">Ready to make your mark?</h2>
        <Button asChild size="lg" className="bg-star hover:bg-star-bright text-void font-semibold px-12 h-14 rounded-full text-lg shadow-[0_0_30px_rgba(232,168,37,0.4)] transition-all hover:scale-105 active:scale-95">
          <Link href="/browse">Begin the Journey</Link>
        </Button>
      </section>
    </div>
  )
}
