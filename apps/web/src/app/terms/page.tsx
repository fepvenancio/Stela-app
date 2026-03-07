import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for the Stela protocol interface.',
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-chalk uppercase tracking-widest mb-4 flex items-center gap-3">
      <div className="w-1.5 h-1.5 bg-star rotate-45" />
      {children}
    </h2>
  )
}

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      {/* Page header */}
      <header className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight">
          Terms of Service
        </h1>
        <p className="text-dust text-sm leading-relaxed max-w-2xl">
          Last updated: March 2026
        </p>
      </header>

      {/* Sections */}
      <section className="space-y-4">
        <SectionHeading>Acceptance of Terms</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            By accessing or using the Stela protocol interface, you agree to
            these terms. The protocol is provided as-is, without warranty. You
            are responsible for your own transactions and wallet security.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Protocol Description</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Stela is a decentralized peer-to-peer lending protocol on StarkNet.
            The interface at stela-dapp.xyz provides a front-end for interacting
            with the protocol&apos;s smart contracts. The protocol operates
            autonomously on-chain — the interface is merely a convenience layer.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Risks</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            DeFi protocols carry inherent risks including smart contract
            vulnerabilities, blockchain network issues, token price volatility,
            and liquidation risk. You may lose some or all of your funds. Past
            performance does not guarantee future results.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>No Financial Advice</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Nothing on this interface constitutes financial, investment, or
            legal advice. You should conduct your own research and consult
            professional advisors before making any financial decisions.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>User Responsibilities</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            You are solely responsible for: securing your wallet and private
            keys, understanding the terms of any inscription you create or fill,
            ensuring you have sufficient collateral, repaying loans before
            expiry to avoid liquidation, and complying with applicable laws in
            your jurisdiction.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Limitation of Liability</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            To the maximum extent permitted by law, the Stela protocol
            contributors shall not be liable for any damages arising from your
            use of the protocol, including but not limited to loss of funds,
            liquidation events, or smart contract failures.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Modifications</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            These terms may be updated at any time. Continued use of the
            interface constitutes acceptance of any modifications.
          </p>
        </div>
      </section>
    </div>
  )
}
