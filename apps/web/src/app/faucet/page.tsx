'use client'

import { useState } from 'react'
import { useAccount, useSendTransaction } from '@starknet-react/core'
import { toU256 } from '@stela/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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
        const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** token.decimals))
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
      toast.error(`Failed to mint ${token.symbol}`, { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{token.symbol}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{token.name}</CardDescription>
          </div>
          <span className="text-[10px] font-mono text-dust bg-abyss px-2 py-1 rounded-md">
            {token.type}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[11px] font-mono text-dust break-all leading-relaxed">
          {token.address}
        </p>

        <div className="flex gap-3 items-end">
          {token.type === 'ERC20' ? (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`amount-${token.symbol}`} className="text-xs text-dust">Amount</Label>
              <Input
                id={`amount-${token.symbol}`}
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`tokenid-${token.symbol}`} className="text-xs text-dust">Token ID</Label>
              <Input
                id={`tokenid-${token.symbol}`}
                type="text"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
              />
            </div>
          )}

          <Button
            variant="gold"
            onClick={handleMint}
            disabled={isPending || !address}
          >
            {isPending ? 'Minting...' : 'Mint'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FaucetPage() {
  const { address } = useAccount()

  return (
    <div className="animate-fade-up max-w-2xl">
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-wide text-chalk mb-3">
          Sepolia Faucet
        </h1>
        <p className="text-dust leading-relaxed">
          Mint mock tokens to your wallet for testing on Sepolia.
        </p>
      </div>

      <div className="mb-8 p-4 rounded-xl border border-edge bg-surface/20">
        <p className="text-sm text-dust">
          Need Sepolia ETH for gas?{' '}
          <a
            href="https://faucet.starknet.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-star hover:text-star-bright transition-colors underline underline-offset-2"
          >
            StarkNet Sepolia Faucet
          </a>
        </p>
      </div>

      {!address ? (
        <p className="text-sm text-ash text-center py-8">
          Connect your wallet to mint test tokens.
        </p>
      ) : (
        <div className="space-y-4">
          {MOCK_TOKENS.map((token) => (
            <MintCard key={token.symbol} token={token} />
          ))}
        </div>
      )}
    </div>
  )
}
