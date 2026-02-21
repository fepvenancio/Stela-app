import type { Metadata } from 'next'
import { Outfit, IBM_Plex_Mono, Cinzel } from 'next/font/google'
import Link from 'next/link'
import { Providers } from './providers'
import { WalletButton } from '@/components/WalletButton'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const ibmMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-mono' })
const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-cinzel' })

export const metadata: Metadata = {
  title: 'Stela Protocol',
  description: 'P2P lending protocol on StarkNet',
}

const NAV_LINKS = [
  { href: '/', label: 'Browse' },
  { href: '/create', label: 'Create' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/faucet', label: 'Faucet' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${ibmMono.variable} ${cinzel.variable} font-sans bg-void text-chalk antialiased`}
      >
        <Providers>
          <div className="starfield" aria-hidden="true" />

          <header className="sticky top-0 z-50 backdrop-blur-xl bg-void/80 border-b border-edge">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <Link
                href="/"
                className="font-display text-lg sm:text-xl tracking-[0.2em] text-star hover:text-star-bright transition-colors"
                style={{ textShadow: '0 0 24px rgba(232,168,37,0.25)' }}
              >
                STELA
              </Link>

              <nav className="flex items-center gap-0.5 sm:gap-1">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-3 sm:px-4 py-2 text-sm text-dust hover:text-chalk transition-colors rounded-lg hover:bg-surface/50"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <WalletButton />
            </div>
          </header>

          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
