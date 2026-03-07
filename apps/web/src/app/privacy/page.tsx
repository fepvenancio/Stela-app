import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the Stela protocol interface.',
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-chalk uppercase tracking-widest mb-4 flex items-center gap-3">
      <div className="w-1.5 h-1.5 bg-star rotate-45" />
      {children}
    </h2>
  )
}

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      {/* Page header */}
      <header className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-dust text-sm leading-relaxed max-w-2xl">
          Last updated: March 2026
        </p>
      </header>

      {/* Sections */}
      <section className="space-y-4">
        <SectionHeading>Overview</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Stela is a decentralized protocol. We do not collect personal
            information, require account creation, or store private data. Your
            interactions with the protocol are recorded on the StarkNet
            blockchain, which is publicly visible.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Blockchain Data</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            All transactions, inscriptions, and settlements are recorded on the
            public StarkNet blockchain. Wallet addresses and transaction history
            are inherently public. The Stela interface indexes this on-chain
            data for display purposes only.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Off-Chain Orders</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            When you create an off-chain order (signed but not yet settled), the
            order data and your signature are stored temporarily in our database
            until the order is settled, cancelled, or expires. After resolution,
            signatures are purged but order metadata (asset details, addresses)
            is retained for historical records.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Analytics</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            The interface may use basic analytics (page views, feature usage) to
            improve the user experience. No personally identifiable information
            is collected. We do not use tracking cookies or third-party
            advertising.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Third-Party Services</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            The interface connects to StarkNet RPC providers and blockchain
            indexing services to function. These services may have their own
            privacy policies. We do not share your data with any third parties
            for marketing purposes.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Data Retention</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            On-chain data is permanent and immutable. Off-chain order data is
            retained as long as the order is active, then signatures are purged
            after settlement/expiry/cancellation. Indexer data mirrors on-chain
            state and is retained indefinitely.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Contact</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            For privacy-related inquiries, reach out via our Discord community
            or GitHub repository.
          </p>
        </div>
      </section>
    </div>
  )
}
