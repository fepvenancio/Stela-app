'use client'

import { useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@fepvenancio/stela-sdk'
import { parseAmount } from '@/lib/amount'
import { Web3ActionWrapper } from '@/components/Web3ActionWrapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/tx'
import { TokenAvatarByAddress } from '@/components/TokenAvatar'
import { formatAddress } from '@/lib/address'

const MOCK_TOKENS = [
  {
    symbol: 'mUSDC',
    name: 'Mock USDC',
    address: '0x034a0cf09c79e7f20fb2136212f27b7dd88e91f9a24b2ac50c5c41ff6b30c59d',
    decimals: 6,
    defaultAmount: '1000',
    type: 'ERC20' as const,
  },
  {
    symbol: 'mWETH',
    name: 'Mock WETH',
    address: '0x07e86764396d61d2179cd1a48033fa4f30897cb172464961a80649aff4da9bdd',
    decimals: 18,
    defaultAmount: '10',
    type: 'ERC20' as const,
  },
  {
    symbol: 'mDAI',
    name: 'Mock DAI',
    address: '0x0479f31a23241b1337375b083099bd1672716edbf908b1b30148a648657a1cee',
    decimals: 18,
    defaultAmount: '10000',
    type: 'ERC20' as const,
  },
  {
    symbol: 'StelaNFT',
    name: 'Stela NFT',
    address: '0x04f2345306bf8ef1c8c1445661354ef08421aa092459445a5d6b46641237e943',
    decimals: 0,
    defaultAmount: '1',
    type: 'ERC721' as const,
  },
]

function MintCard({
  token,
}: {
  token: (typeof MOCK_TOKENS)[number]
}) {
  const { address } = useAccount()
  const { sendAsync, isPending } = useSendTransaction({})
  const [amount, setAmount] = useState(token.defaultAmount)
  const [tokenId, setTokenId] = useState(() => String(Math.floor(Math.random() * 1_000_000)))

  async function handleMint() {
    if (!address) return

    try {
      if (token.type === 'ERC20') {
        const rawAmount = parseAmount(amount, token.decimals)
        const result = await sendAsync([
          {
            contractAddress: token.address,
            entrypoint: 'mint',
            calldata: [address, ...toU256(rawAmount)],
          },
        ])
        toast.success(`Minted ${token.symbol}`, { description: result.transaction_hash })
      } else {
        const result = await sendAsync([
          {
            contractAddress: token.address,
            entrypoint: 'mint',
            calldata: [address, ...toU256(BigInt(tokenId))],
          },
        ])
        toast.success(`Minted ${token.symbol}`, { description: result.transaction_hash })
        setTokenId(String(Math.floor(Math.random() * 1_000_000)))
      }
    } catch (err: unknown) {
      toast.error(`Failed to mint ${token.symbol}`, { description: getErrorMessage(err) })
    }
  }

  return (
    <div className="bg-surface/5 border border-edge/30 rounded-lg overflow-hidden hover:border-edge-bright transition-all group">
      <div className="px-5 py-4 border-b border-edge/20 bg-surface/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TokenAvatarByAddress address={token.address} size={28} />
          <div>
            <h3 className="text-sm font-display text-chalk uppercase tracking-wider">{token.symbol}</h3>
            <p className="text-[10px] text-dust">{token.name}</p>
          </div>
        </div>
        <span className="text-[9px] font-mono font-bold text-star bg-star/10 px-2 py-0.5 rounded border border-star/20">
          {token.type}
        </span>
      </div>
      
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <span className="text-[9px] text-dust uppercase tracking-widest font-bold">Contract Address</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(token.address)
              toast.success('Address copied', { description: formatAddress(token.address) })
            }}
            className="w-full text-left text-[10px] font-mono text-dust bg-void/30 px-2 py-1.5 rounded border border-edge/10 hover:border-star/30 hover:text-chalk transition-colors cursor-pointer truncate"
            title={token.address}
          >
            {formatAddress(token.address)}
          </button>
        </div>

        <div className="flex gap-3 items-end">
          {token.type === 'ERC20' ? (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`amount-${token.symbol}`} className="text-[10px] text-dust uppercase tracking-widest font-bold">Amount</Label>
              <Input
                id={`amount-${token.symbol}`}
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-surface/50 border-edge/50 h-9 font-mono text-sm"
              />
            </div>
          ) : (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`tokenid-${token.symbol}`} className="text-[10px] text-dust uppercase tracking-widest font-bold">Token ID</Label>
              <Input
                id={`tokenid-${token.symbol}`}
                type="text"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="bg-surface/50 border-edge/50 h-9 font-mono text-sm"
              />
            </div>
          )}

          <Button
            variant="gold"
            onClick={handleMint}
            disabled={isPending || !address}
            className="h-9 px-6 uppercase tracking-widest text-xs"
          >
            {isPending ? '...' : 'Mint'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function FaucetPage() {
  return (
    <div className="animate-fade-up pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Token Grid */}
        <div className="lg:col-span-2">
          <Web3ActionWrapper message="Connect your wallet to mint test tokens">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {MOCK_TOKENS.map((token) => (
                <MintCard key={token.symbol} token={token} />
              ))}
            </div>
          </Web3ActionWrapper>
        </div>

        {/* Right Column: Info & Resources */}
        <div className="space-y-6">
          <section className="bg-surface/5 border border-edge/30 rounded-lg p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-[11px] text-dust uppercase tracking-widest font-bold border-b border-edge/10 pb-3">
                Gas & Support
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-star/5 border border-star/20 space-y-2">
                  <span className="text-[10px] text-star uppercase tracking-widest font-bold block">Sepolia ETH</span>
                  <p className="text-xs text-dust leading-relaxed">
                    You need Sepolia ETH to pay for gas on StarkNet Sepolia. 
                  </p>
                  <a
                    href="https://faucet.starknet.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-star hover:text-star-bright transition-colors text-xs font-bold uppercase tracking-wider mt-1 group"
                  >
                    Official Faucet
                    <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>

                <div className="p-4 rounded-md bg-surface/10 border border-edge/20 space-y-2">
                  <span className="text-[10px] text-dust uppercase tracking-widest font-bold block">Documentation</span>
                  <p className="text-xs text-dust leading-relaxed">
                    Learn more about using mock assets for testing inscriptions and lending.
                  </p>
                  <a
                    href="/docs"
                    className="inline-flex items-center gap-2 text-chalk hover:text-star transition-colors text-xs font-bold uppercase tracking-wider mt-1 group"
                  >
                    View Docs
                    <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <div className="p-5 rounded-lg border border-edge/20 bg-surface/5">
            <h4 className="text-[10px] text-dust uppercase tracking-widest font-bold mb-2">Usage Notice</h4>
            <p className="text-[11px] text-dust leading-relaxed italic">
              Mock tokens have no real-world value and are intended for testing on StarkNet Sepolia only. 
              The Stela team does not provide mainnet assets.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
