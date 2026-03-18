export const queryKeys = {
  inscriptions: {
    all: ['inscriptions'] as const,
    list: (filters: { status?: string; address?: string; page?: number }) =>
      ['inscriptions', 'list', filters] as const,
    detail: (id: string) => ['inscriptions', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters: { status?: string; address?: string; page?: number; limit?: number }) =>
      ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    book: (debtToken: string, collateralToken: string, duration?: string) =>
      ['orders', 'book', debtToken, collateralToken, duration] as const,
  },
  pairs: {
    all: ['pairs'] as const,
    listings: (debtToken: string, collateralToken: string) =>
      ['pairs', 'listings', debtToken, collateralToken] as const,
  },
  portfolio: {
    all: (address: string) => ['portfolio', address] as const,
    inscriptions: (address: string) => ['portfolio', address, 'inscriptions'] as const,
    orders: (address: string) => ['portfolio', address, 'orders'] as const,
    shares: (address: string) => ['portfolio', address, 'shares'] as const,
    collectionOffers: (address: string) => ['portfolio', address, 'collectionOffers'] as const,
    refinances: (address: string) => ['portfolio', address, 'refinances'] as const,
    renegotiations: (address: string) => ['portfolio', address, 'renegotiations'] as const,
  },
  shares: {
    listings: (params: Record<string, string | undefined>) =>
      ['shares', 'listings', params] as const,
    detail: (id: string) => ['shares', 'detail', id] as const,
  },
} as const
