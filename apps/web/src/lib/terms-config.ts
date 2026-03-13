import { hash } from 'starknet'

/**
 * Terms of Use configuration.
 * Bump TERMS_VERSION when terms change — users must re-sign.
 */
export const TERMS_VERSION = '1.0'

/**
 * The terms text that users sign. Keep this in sync with /terms page.
 * The hash is derived from this text and included in the SNIP-12 typed data.
 */
export const TERMS_TEXT = `STELA PROTOCOL — TERMS OF USE ACKNOWLEDGMENT

By signing this message, I confirm that:

1. I am accessing a decentralized orderbook protocol. Stela is open-source smart contract infrastructure that matches peer-to-peer orders. It is not a financial service, lending platform, or exchange.

2. I am solely responsible for compliance with laws in my jurisdiction, including but not limited to securities, tax, and financial regulations.

3. I understand the risks of DeFi, including smart contract risk, liquidation risk, counterparty risk, and total loss of funds.

4. I am not a person or entity subject to sanctions by OFAC, the UN, the EU, or the UK OFSI.

5. I am not accessing this protocol from a restricted jurisdiction where such activity is prohibited.

6. No party — including the Stela Foundation, protocol developers, relayer operators, or frontend hosts — provides financial advice, custody, or intermediation.

7. All interactions are peer-to-peer, final, and irreversible once settled on-chain.`

/** Poseidon hash of the terms text, used in SNIP-12 typed data */
export const TERMS_HASH = hash.computePoseidonHash(
  hash.computePoseidonHash('0x0', TERMS_VERSION),
  TERMS_TEXT.length.toString(),
)
