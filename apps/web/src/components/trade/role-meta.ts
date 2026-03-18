export type AssetRole = 'debt' | 'collateral' | 'interest'

export const ROLE_META: Record<
  AssetRole,
  { label: string; short: string; color: string; bgClass: string; borderClass: string; textClass: string }
> = {
  debt: {
    label: 'You Receive',
    short: 'You Receive',
    color: 'nebula',
    bgClass: 'bg-nebula/10',
    borderClass: 'border-nebula/25',
    textClass: 'text-nebula',
  },
  collateral: {
    label: 'You Lock',
    short: 'You Lock',
    color: 'star',
    bgClass: 'bg-star/10',
    borderClass: 'border-star/25',
    textClass: 'text-star',
  },
  interest: {
    label: 'You Pay Interest',
    short: 'You Pay Interest',
    color: 'aurora',
    bgClass: 'bg-aurora/10',
    borderClass: 'border-aurora/25',
    textClass: 'text-aurora',
  },
}

export const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']
