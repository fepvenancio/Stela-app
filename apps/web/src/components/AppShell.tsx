'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { NetworkMismatchBanner } from './NetworkMismatchBanner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Footer } from '@/components/Footer'

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
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-2a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
    </svg>
  )},
]

const DROPDOWN_LINKS = [
  { href: '/nft', label: 'Genesis NFT', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3l1 10" /><path d="M2 9h20" />
    </svg>
  )},
  { href: '/docs', label: 'Docs', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )},
  { href: '/faucet', label: 'Faucet', icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6m0 0a4 4 0 014 4v6a2 2 0 01-2 2h-4a2 2 0 01-2-2v-6a4 4 0 014-4z" />
    </svg>
  )},
  { href: 'https://github.com/fepvenancio/Stela', label: 'Protocol', external: true, icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  )},
]

const EXTERNAL_LINKS = [
  { href: 'https://github.com/fepvenancio/Stela', label: 'Protocol' },
]

const visibleLinks = NAV_LINKS

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

function LogoDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center text-star-dim hover:text-star transition-colors cursor-pointer ml-1"
        aria-label="More links"
        aria-expanded={open}
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-abyss/95 border border-edge/30 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden z-50">
          {DROPDOWN_LINKS.map((link) => {
            const Icon = link.icon
            if (link.external) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-dust hover:text-chalk hover:bg-surface/50 transition-colors"
                >
                  <Icon className="w-4 h-4 text-dust/60" />
                  {link.label}
                  <svg className="w-3 h-3 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-dust hover:text-chalk hover:bg-surface/50 transition-colors"
              >
                <Icon className="w-4 h-4 text-dust/60" />
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

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
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-void/80 border-b border-edge/20 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
            : 'bg-transparent'
        }`}
      >
        <NetworkMismatchBanner />
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 sm:px-12 relative">
          {/* Logo + dropdown */}
          <div className="flex items-center gap-0.5 shrink-0">
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
            <LogoDropdown />
          </div>

          {/* Desktop nav links — absolute center */}
          <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2" aria-label="Main navigation">
            {visibleLinks.map((link) => {
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

          {/* Right side: help + wallet + hamburger */}
          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full border border-edge/30 text-dust hover:text-star hover:border-star/30 transition-colors"
              aria-label="Help & Docs"
            >
              <span className="text-xs font-semibold">?</span>
            </Link>
            <WalletButton />
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
              {visibleLinks.map((link) => {
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

            {/* Extra links (NFT, Docs, Faucet, Protocol) */}
            <div className="px-3 border-t border-edge/30 pt-4 space-y-1">
              {DROPDOWN_LINKS.map((link) => {
                const Icon = link.icon
                if (link.external) {
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ash hover:text-chalk transition-colors"
                    >
                      <Icon className="w-4 h-4 opacity-50" />
                      {link.label}
                    </a>
                  )
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ash hover:text-chalk transition-colors"
                  >
                    <Icon className="w-4 h-4 opacity-50" />
                    {link.label}
                  </Link>
                )
              })}
            </div>

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

      <Footer />

      <ScrollToTopButton />
    </div>
  )
}
