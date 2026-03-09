'use client'

import { useState, useEffect, useCallback } from 'react'
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
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 sm:px-12">
          {/* Logo */}
          <Link
            href="/trade"
            className="flex items-center gap-2.5 font-display text-xl tracking-[0.3em] text-star hover:text-star-bright transition-all group shrink-0"
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

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
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

          {/* Right side: wallet + hamburger */}
          <div className="flex items-center gap-3">
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

            {/* External links */}
            <div className="px-3 border-t border-edge/30 pt-4 space-y-1">
              {EXTERNAL_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ash hover:text-chalk transition-colors"
                >
                  <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  {label}
                </a>
              ))}
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
