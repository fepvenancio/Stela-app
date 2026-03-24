import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'
import { TermsGate } from '@/components/TermsGate'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'Stela Protocol',
    template: '%s | Stela',
  },
  description: 'Peer-to-peer lending inscriptions on StarkNet. Gasless order signing, collateral locking, and multi-lender vaults.',
  metadataBase: new URL('https://stela-dapp.xyz'),
  manifest: '/manifest.json',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Stela Protocol',
    description: 'Peer-to-peer lending inscriptions on StarkNet. Gasless order signing, collateral locking, and multi-lender vaults.',
    siteName: 'Stela Protocol',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Stela Protocol — P2P Lending on StarkNet' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stela Protocol',
    description: 'P2P lending inscriptions on StarkNet — gasless, permissionless, immutable.',
    images: ['/og.png'],
  },
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#050505] text-white antialiased`}
      >
        <Providers>
          <TooltipProvider>
            <AppShell>
              <ErrorBoundary>{children}</ErrorBoundary>
            </AppShell>
            <TermsGate />
            <Toaster richColors />
          </TooltipProvider>
        </Providers>
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  )
}
