import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stela Protocol',
  description: 'P2P lending protocol on StarkNet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
            <a href="/" className="text-xl font-bold">Stela</a>
            <nav className="flex items-center gap-6">
              <a href="/" className="hover:underline">Browse</a>
              <a href="/create" className="hover:underline">Create</a>
              <a href="/portfolio" className="hover:underline">Portfolio</a>
            </nav>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
