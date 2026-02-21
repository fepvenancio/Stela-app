import { InjectedConnector } from 'starknetkit/injected'

/**
 * Single source of truth for wallet connectors.
 * Used by both StarknetConfig (providers.tsx) and the starknetkit connect modal.
 */
export const connectors = [
  new InjectedConnector({ options: { id: 'argentX', name: 'Argent X' } }),
  new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
]
