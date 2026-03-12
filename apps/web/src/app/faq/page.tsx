import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Common questions about the Stela protocol, lending, swaps, and fees.',
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-chalk uppercase tracking-widest mb-4 flex items-center gap-3">
      <div className="w-1.5 h-1.5 bg-star rotate-45" />
      {children}
    </h2>
  )
}

export default function FAQ() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      {/* Page header */}
      <header className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl text-chalk tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-dust text-sm leading-relaxed max-w-2xl">
          Common questions about the Stela protocol, lending, swaps, and fees.
        </p>
      </header>

      {/* Questions */}
      <section className="space-y-4">
        <SectionHeading>What is Stela?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Stela is a peer-to-peer lending and swap protocol built on StarkNet.
            It enables trustless lending through on-chain inscriptions — borrowers
            create terms (debt, collateral, interest, duration) and lenders fill
            them directly. No intermediaries, no liquidity pools.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>How do loans work?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            A borrower creates an inscription specifying what they want to borrow
            (debt), what they offer as collateral, interest terms, and loan
            duration. Lenders browse available inscriptions and fill ones that
            match their criteria. The borrower&apos;s collateral is locked in a
            dedicated contract (locker) until the loan is repaid or expires. If
            the borrower doesn&apos;t repay within the duration, the lender can
            liquidate and claim the collateral.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>How do swaps work?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Swaps are inscriptions with zero duration. They function as instant
            peer-to-peer token exchanges — no AMM, no slippage, no liquidity
            pool. Create a swap by specifying what you give and what you want. If
            a matching counterparty exists, the swap settles immediately.
            Otherwise, your swap order is broadcast for others to fill.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What are the fees?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            All fees are charged at settlement only — there are no fees for
            creating, canceling, or redeeming.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>
              Lending: 0.25% (25 BPS) — split between 0.05% relayer fee and
              0.20% treasury fee
            </li>
            <li>
              Swaps: 0.15% (15 BPS) — split between 0.05% relayer fee and
              0.10% treasury fee
            </li>
            <li>Redemption: Free (0%)</li>
            <li>Liquidation: Free (0%)</li>
          </ul>
          <p>
            Genesis NFT holders receive up to 50% discount on the treasury
            portion of fees.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What is a Genesis NFT?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            The StelaGenesis NFT collection (300 supply) grants holders protocol
            fee discounts. Holding at least one NFT gives a 15% base discount on
            treasury fees, with additional discounts based on trading volume
            tiers (+5% per tier) and number of NFTs held (+2% per extra NFT), up
            to a 50% cap.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>How does early repayment work?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Borrowers can repay a loan at any time before it expires. When a loan
            is repaid early, interest is pro-rated by elapsed time — you only pay
            for the time you actually held the debt.
          </p>
          <p>
            The formula is:{' '}
            <span className="text-chalk font-mono">
              ceil(full_interest &times; elapsed / duration)
            </span>
            . Rounding uses ceiling (round up) to protect lenders, ensuring they
            always receive at least 1 wei of each interest asset.
          </p>
          <p>
            For example, if a loan specifies 100 DAI interest over 30 days and the
            borrower repays at day 15, the interest owed is approximately 50 DAI.
            The borrower saves the remaining 50 DAI by repaying early.
          </p>
          <p>
            Swaps (loans with zero duration) always charge the full interest amount
            since there is no time component to pro-rate against.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What is refinancing?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Refinancing lets a new lender offer better terms on an existing loan.
            When the borrower approves the refinance, the old lender is
            automatically repaid (with pro-rated interest) and the new
            lender&apos;s terms take effect — no manual repayment or new
            inscription needed.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What happens when a loan expires?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            When a loan expires, a 24-hour grace period begins during which the
            borrower can still repay. After the grace period, a Dutch auction
            starts — the collateral price declines over time until someone bids.
            This ensures lenders recover value even if the borrower defaults.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Can loan terms be changed?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Yes, through renegotiation. Either the borrower or lender can propose
            new terms (duration, interest, or both). The counterparty reviews the
            proposal, commits to it, and then the proposer executes the change
            on-chain. Both parties must agree before any terms are modified.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>Can I sell my locked collateral?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Yes. A borrower can create a sale offer for collateral that is
            currently locked in a loan. A buyer purchases the collateral at the
            agreed price, which is used to repay the outstanding debt. Any
            remaining proceeds go to the borrower.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What are collection offers?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Collection offers let a lender make a lending offer against any NFT
            in a collection, rather than a specific token ID. Any borrower
            holding an NFT from that collection can accept the offer, making it
            easier for lenders to deploy capital across an entire collection.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading>What networks does Stela support?</SectionHeading>
        <div className="text-dust text-sm leading-relaxed space-y-3">
          <p>
            Stela is currently deployed on StarkNet Sepolia (testnet). Mainnet
            deployment is planned after the security audit and ownership
            renouncement are complete.
          </p>
        </div>
      </section>
    </div>
  )
}
