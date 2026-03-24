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
  { href: '/borrow', label: 'Borrow', icon: FileSignature },
  { href: '/swap', label: 'Swap', icon: ArrowLeftRight },
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

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2.5 bg-white/[0.02] px-4 py-2 rounded-xl border border-border">
              {/* StarkNet logo */}
              <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.21 10.803c-.353-.77-1.079-2.403-2.18-2.653-.39-.089-.828.017-1.318.314a8.675 8.675 0 0 0-1.049.722c-.57.451-1.22.963-2.024 1.153-.833.197-1.636-.023-2.362-.223-.53-.147-1.032-.285-1.453-.238-1.16.13-1.759 1.662-2.073 2.414l-.076.178c-.666 1.56-1.36 3.34-1.21 5.204.09 1.122.431 2.116.81 3.1l.028.073c.27.7.573 1.421 1.041 2.02.515.66 1.196 1.126 2.027 1.389.567.179 1.16.253 1.762.175.495-.064.97-.211 1.43-.353l.14-.044c.703-.218 1.43-.443 2.19-.443.76 0 1.487.225 2.19.443l.14.044c.46.143.935.29 1.43.353.601.078 1.195.004 1.762-.175.831-.263 1.512-.73 2.027-1.388.468-.6.77-1.32 1.041-2.021l.028-.073c.379-.984.72-1.978.81-3.1.15-1.863-.544-3.643-1.21-5.204l-.076-.178-.003-.006Z" fill="currentColor"/>
                <path d="M18.048 5.682a2.77 2.77 0 0 0 1.839-1.41A2.814 2.814 0 0 0 20.2 2.55a2.77 2.77 0 0 0-1.84 1.41 2.814 2.814 0 0 0-.312 1.722Z" fill="currentColor"/>
              </svg>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {NETWORK === 'sepolia' ? 'Sepolia' : 'Mainnet'}
                </span>
              </div>
            </div>
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
