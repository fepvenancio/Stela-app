'use client'

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { NetworkMismatchBanner } from './NetworkMismatchBanner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Footer } from '@/components/Footer'
import { NETWORK } from '@/lib/config'

const NAV_LINKS = [
  { href: '/trade', label: 'Trade', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )},
  { href: '/markets', label: 'Markets', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )},
  { href: '/portfolio', label: 'Portfolio', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  )},
  { href: '/nft', label: 'NFT', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3l1 10" /><path d="M2 9h20" />
    </svg>
  )},
  ...(NETWORK === 'sepolia' ? [{
    href: '/faucet', label: 'Faucet', icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6m0 0a4 4 0 014 4v6a2 2 0 01-2 2h-4a2 2 0 01-2-2v-6a4 4 0 014-4z" />
      </svg>
    ),
  }] : []),
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
      className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-surface/80 border border-edge/50 flex items-center justify-center text-dust hover:text-star hover:border-star/50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  )
}

function HelpButton({ footerRef }: { footerRef: RefObject<HTMLDivElement | null> }) {
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [footerRef])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div
      ref={ref}
      className={`fixed bottom-6 left-6 z-50 transition-all duration-300 ${
        hidden ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}
    >
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 bg-abyss/95 border border-edge/30 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden">
          <Link
            href="/docs"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dust hover:text-chalk hover:bg-surface/50 transition-colors"
          >
            <svg className="w-4 h-4 text-dust/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Docs
          </Link>
          <a
            href="https://github.com/fepvenancio/Stela"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-dust hover:text-chalk hover:bg-surface/50 transition-colors"
          >
            <svg className="w-4 h-4 text-dust/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Protocol
            <svg className="w-3 h-3 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Help & Docs"
        className="w-10 h-10 rounded-full bg-surface/80 border border-edge/50 flex items-center justify-center text-dust hover:text-star hover:border-star/50 transition-all duration-300"
      >
        <span className="text-sm font-semibold">?</span>
      </button>
    </div>
  )
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const footerRef = useRef<HTMLDivElement>(null)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Track scroll for navbar background
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navbar */}
      <header
        className={`sticky top-0 z-40 bg-void/95 backdrop-blur-sm border-b transition-all duration-300 ${
          scrolled
            ? 'border-edge/20 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
            : 'border-transparent'
        }`}
      >
        <NetworkMismatchBanner />
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 sm:px-12 relative">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <Link
              href="/trade"
              className="flex items-center gap-2.5 font-display text-xl tracking-[0.3em] text-star hover:text-star-bright transition-all group"
            >
              <svg viewBox="0 0 512 512" className="w-7 h-7" fill="none" aria-hidden="true">
                <rect x="96" y="440" width="320" height="32" rx="4" fill="currentColor"/>
                <path d="M128 440 V112 Q256 80 384 112 V440 H128Z" fill="currentColor"/>
                <rect x="128" y="144" width="256" height="8" fill="#0a0a0e" fillOpacity="0.2"/>
                <rect x="176" y="210" width="160" height="20" rx="4" fill="#0a0a0e" fillOpacity="0.2"/>
                <rect x="176" y="260" width="160" height="20" rx="4" fill="#0a0a0e" fillOpacity="0.2"/>
                <rect x="176" y="310" width="160" height="20" rx="4" fill="#0a0a0e" fillOpacity="0.2"/>
              </svg>
              <span className="relative">
                STELA
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-star/50 transition-all group-hover:w-full" />
              </span>
            </Link>
          </div>

          {/* Desktop nav links — absolute center */}
          <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2" aria-label="Main navigation">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 font-display text-[13px] uppercase tracking-[0.15em] transition-colors duration-200 ${
                    active
                      ? 'text-star'
                      : 'text-dust hover:text-chalk'
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute bottom-0.5 left-4 right-4 h-px bg-star/60" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right side: wallet (desktop only) + hamburger (mobile only) */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <WalletButton />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-dust hover:text-chalk"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu (Sheet from right) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 bg-void/95 border-edge/20 p-0 stela-pattern" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex flex-col h-full">
            {/* Mobile nav links */}
            <nav className="flex-1 px-3 pt-6 space-y-1" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href)
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-display text-[13px] uppercase tracking-[0.15em] transition-all duration-200 ${
                      active
                        ? 'bg-star/10 text-star'
                        : 'text-dust hover:text-chalk hover:bg-surface/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-star' : 'text-dust'}`} />
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            {/* Wallet at bottom */}
            <div className="px-4 pb-6 pt-4">
              <WalletButton />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-12 py-4 sm:py-8 animate-fade-in">
        {children}
      </main>

      <div ref={footerRef}>
        <Footer />
      </div>

      <HelpButton footerRef={footerRef} />
      <ScrollToTopButton />
    </div>
  )
}
