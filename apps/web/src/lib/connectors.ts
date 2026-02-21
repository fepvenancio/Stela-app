import { InjectedConnector } from 'starknetkit/injected'

export const connectors = [
  new InjectedConnector({ options: { id: 'argentX', name: 'Argent X' } }),
  new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
]
