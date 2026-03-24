'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { NetworkMismatchBanner } from './NetworkMismatchBanner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Footer } from '@/components/Footer'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { NETWORK } from '@/lib/config'
import {
  LayoutDashboard,
  HandCoins,
  FileSignature,
  ArrowLeftRight,
  Layers,
  Briefcase,
  Gem,
  Droplets,
  ChevronUp,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Lend', icon: HandCoins },
  { href: '/trade?mode=advanced', label: 'Borrow', icon: FileSignature },
  { href: '/trade?mode=swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/stelas', label: 'Stelas', icon: Layers },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/nft', label: 'NFT', icon: Gem },
  ...(NETWORK === 'sepolia' ? [{ href: '/faucet', label: 'Faucet', icon: Droplets }] : []),
]

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-surface/80 border border-border flex items-center justify-center text-gray-500 hover:text-accent hover:border-accent/50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ChevronUp size={16} />
    </button>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header */}
        <header className="h-20 bg-surface/60 backdrop-blur-2xl border-b border-border px-4 sm:px-10 flex items-center justify-between sticky top-0 z-40">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-500 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </Button>

          <GlobalSearch />

          <div className="flex items-center">
            <WalletButton />
          </div>
        </header>

        {/* Network mismatch banner */}
        <NetworkMismatchBanner />

        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-72 bg-surface/95 border-border p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex flex-col h-full">
              <nav className="flex-1 px-3 pt-6 space-y-1" aria-label="Mobile navigation">
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.href)
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] uppercase tracking-[0.15em] font-semibold transition-all duration-200 ${
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-gray-500'}`} />
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="px-4 pb-6 pt-4">
                <WalletButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Page content */}
        <main className="relative z-10 flex-1 p-4 sm:p-10 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>

        <Footer />
      </div>

      <ScrollToTopButton />
    </div>
  )
}
