import type { Metadata } from 'next'
import { Outfit, IBM_Plex_Mono, Cinzel } from 'next/font/google'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const ibmMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-mono' })
const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-cinzel' })

export const metadata: Metadata = {
  title: {
    default: 'Stela Protocol',
    template: '%s | Stela',
  },
  description: 'Peer-to-peer lending inscriptions on StarkNet. Gasless order signing, collateral locking, and multi-lender vaults.',
  metadataBase: new URL('https://stela-dapp.xyz'),
  openGraph: {
    title: 'Stela Protocol',
    description: 'Peer-to-peer lending inscriptions on StarkNet. Gasless order signing, collateral locking, and multi-lender vaults.',
    siteName: 'Stela Protocol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stela Protocol',
    description: 'P2P lending inscriptions on StarkNet — gasless, permissionless, immutable.',
  },
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${ibmMono.variable} ${cinzel.variable} font-sans bg-void text-chalk antialiased`}
      >
        <Providers>
          <TooltipProvider>
            <div className="starfield" aria-hidden="true" />
            <AppShell>
              <ErrorBoundary>{children}</ErrorBoundary>
            </AppShell>
            <Toaster richColors />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
