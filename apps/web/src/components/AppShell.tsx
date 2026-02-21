'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

const NAV_LINKS = [
  { href: '/', label: 'Browse' },
  { href: '/create', label: 'Create' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/faucet', label: 'Faucet' },
]

const EXTERNAL_LINKS = [
  { href: 'https://github.com/fepvenancio/Stela', label: 'Protocol' },
]

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-star/10 text-star border border-star/20'
          : 'text-dust hover:text-chalk hover:bg-surface/50 border border-transparent'
      }`}
    >
      {label}
    </Link>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-display text-xl tracking-[0.2em] text-star hover:text-star-bright transition-colors"
          style={{ textShadow: '0 0 24px rgba(232,168,37,0.25)' }}
        >
          STELA
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_LINKS.map(({ href, label }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            active={pathname === href}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* External */}
      <div className="px-3 pb-5 border-t border-edge pt-4 space-y-1">
        {EXTERNAL_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-dust hover:text-chalk hover:bg-surface/50 transition-colors"
          >
            {label}
            <svg
              className="w-3 h-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
              />
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-56 lg:flex-col bg-void/90 backdrop-blur-xl border-r border-edge z-40">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 bg-void/95 backdrop-blur-xl border-edge p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="lg:ml-56 min-h-dvh flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 backdrop-blur-xl bg-void/80 border-b border-edge">
          {/* Hamburger (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-2 text-dust hover:text-chalk"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </Button>

          {/* Spacer for desktop (no hamburger) */}
          <div className="hidden lg:block" />

          <WalletButton />
        </header>

        {/* Page content */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </main>
      </div>
    </>
  )
}
