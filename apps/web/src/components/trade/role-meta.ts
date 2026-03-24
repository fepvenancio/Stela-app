export type AssetRole = 'debt' | 'collateral' | 'interest'

export const ROLE_META: Record<
  AssetRole,
  { label: string; short: string; color: string; bgClass: string; borderClass: string; textClass: string }
> = {
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

export const ROLES: AssetRole[] = ['debt', 'collateral', 'interest']
