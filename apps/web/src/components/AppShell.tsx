'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from './WalletButton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

const NAV_LINKS = [
  { href: '/', label: 'Home', icon: (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { href: '/browse', label: 'Browse', icon: (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )},
  { href: '/create', label: 'Inscribe', icon: (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )},
  { href: '/portfolio', label: 'Vaults', icon: (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { href: '/faucet', label: 'Faucet', icon: (props: any) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )},
]

const EXTERNAL_LINKS = [
  { href: 'https://github.com/fepvenancio/Stela', label: 'Protocol' },
]

function NavLink({
  href,
  label,
  active,
  icon: Icon,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  icon: any
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        active
          ? 'bg-star/10 text-star shadow-[0_0_12px_rgba(232,168,37,0.1)]'
          : 'text-dust hover:text-chalk hover:bg-surface/50'
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-star' : 'text-dust'}`} />
      {label}
    </Link>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-8">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-display text-2xl tracking-[0.3em] text-star hover:text-star-bright transition-all group"
        >
          <span className="relative">
            STELA
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-star/50 transition-all group-hover:w-full" />
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            active={pathname === link.href}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* External */}
      <div className="px-3 pb-6 border-t border-edge/30 pt-4 space-y-1">
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-void/50 backdrop-blur-2xl border-r border-edge/10 z-40 stela-pattern">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-void/95 backdrop-blur-2xl border-edge/20 p-0 stela-pattern" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="lg:ml-64 min-h-dvh flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 h-20 flex items-center justify-between px-4 sm:px-12 bg-transparent pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            {/* Hamburger (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden -ml-2 text-dust hover:text-chalk"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </Button>
          </div>

          <div className="pointer-events-auto">
            <WalletButton />
          </div>
        </header>

        {/* Page content */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-12 py-4 sm:py-8 animate-fade-in">
          {children}
        </main>
      </div>
    </>
  )
}
