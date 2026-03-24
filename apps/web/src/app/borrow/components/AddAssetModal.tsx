'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { AssetType, TokenInfo } from '@fepvenancio/stela-sdk'
import { NETWORK } from '@/lib/config'
import type { AssetInputValue } from '@/components/AssetInput'
import { TokenSelectorModal } from '@/components/TokenSelectorModal'
import { TokenAvatar } from '@/components/TokenAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type AssetRole = 'debt' | 'collateral' | 'interest'

const ROLE_META: Record<AssetRole, { label: string; short: string; color: string; bgClass: string; borderClass: string; textClass: string }> = {
  debt: {
    label: 'You Receive',
    short: 'You Receive',
    color: 'accent',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/25',
    textClass: 'text-accent',
  },
  collateral: {
    label: 'You Lock',
    short: 'You Lock',
    color: 'accent',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/25',
    textClass: 'text-accent',
  },
  interest: {
    label: 'You Pay Interest',
    short: 'You Pay Interest',
    color: 'green-500',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/25',
    textClass: 'text-green-500',
  },
}

const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']

export function AddAssetModal({
  open,
  onOpenChange,
  onAdd,
  balances,
  availableRoles = ROLES,
  defaultRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (asset: AssetInputValue, role: AssetRole) => void
  balances?: Map<string, bigint>
  availableRoles?: AssetRole[]
  defaultRole?: AssetRole
}) {
  const [step, setStep] = useState<'token' | 'configure'>('token')
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('ERC20')
  const [amount, setAmount] = useState('')
  const [tokenId, setTokenId] = useState('0')
  const [role, setRole] = useState<AssetRole>('debt')
  const transitionRef = useRef(false)

  const isNft = assetType === 'ERC721' || assetType === 'ERC1155'
  const address = selectedToken?.addresses[NETWORK] ?? customAddress

  const reset = useCallback(() => {
    setStep('token')
    setSelectedToken(null)
    setIsCustom(false)
    setCustomAddress('')
    setAssetType('ERC20')
    setAmount('')
    setTokenId('0')
    setRole(defaultRole ?? 'debt')
  }, [defaultRole])

  // When modal opens, apply the defaultRole if provided
  useEffect(() => {
    if (open && defaultRole) {
      setRole(defaultRole)
    }
  }, [open, defaultRole])

  function handleTokenSelect(token: TokenInfo) {
    transitionRef.current = true
    setSelectedToken(token)
    setIsCustom(false)
    setAssetType('ERC20')
    setStep('configure')
  }

  function handleCustomSelect() {
    transitionRef.current = true
    setSelectedToken(null)
    setIsCustom(true)
    setStep('configure')
  }

  function handleAdd() {
    const asset: AssetInputValue = {
      asset: address,
      asset_type: assetType,
      value: isNft ? '0' : amount,
      token_id: tokenId,
      decimals: selectedToken?.decimals ?? 18,
    }
    onAdd(asset, role)
    reset()
    onOpenChange(false)
  }

  const canAdd = address && (isNft ? tokenId !== '' : amount !== '' && parseFloat(amount) > 0)

  return (
    <>
      <TokenSelectorModal
        open={open && step === 'token'}
        onOpenChange={(o) => {
          if (!o) {
            if (transitionRef.current) {
              transitionRef.current = false
              return
            }
            reset()
            onOpenChange(false)
          }
        }}
        onSelect={handleTokenSelect}
        showCustomOption={true}
        onCustomSelect={handleCustomSelect}
        balances={balances}
      />

      <Dialog
        open={open && step === 'configure'}
        onOpenChange={(o) => {
          if (!o) {
            reset()
            onOpenChange(false)
          }
        }}
      >
        <DialogContent className="bg-[#050505] border-border/50 text-white p-0 gap-0 sm:max-w-md overflow-hidden" showCloseButton={false}>
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="font-bold text-sm tracking-widest text-accent uppercase flex items-center gap-2.5">
              {selectedToken ? (
                <>
                  <TokenAvatar token={selectedToken} size={20} />
                  {selectedToken.symbol}
                </>
              ) : (
                'Custom Token'
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pt-4 pb-5 space-y-4">
            {isCustom && (
              <div className="space-y-2">
                <Label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Contract Address</Label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="flex gap-1.5 pt-1">
                  {(['ERC20', 'ERC721', 'ERC1155', 'ERC4626'] as AssetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAssetType(t)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                        assetType === t
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border text-gray-500 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {isNft ? 'Token ID' : 'Amount'}
              </Label>
              {isNft ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter token ID"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  className="font-mono"
                />
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || /^\d*\.?\d{0,3}$/.test(raw)) setAmount(raw)
                    }}
                    className={`text-lg font-mono h-12 ${selectedToken ? 'pr-16' : ''}`}
                    autoFocus
                  />
                  {selectedToken && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-mono pointer-events-none">
                      {selectedToken.symbol}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Role</Label>
              <div className={`grid gap-1.5 ${availableRoles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {availableRoles.map((r) => {
                  const meta = ROLE_META[r]
                  const selected = role === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? `${meta.borderClass} ${meta.bgClass} ${meta.textClass}`
                          : 'border-border/50 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={handleAdd}
              disabled={!canAdd}
            >
              Add {ROLE_META[role].label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
