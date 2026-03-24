'use client'

import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Menu, X, ShieldCheck } from 'lucide-react'
import { SidebarNavItem } from './SidebarNavItem'
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
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade', label: 'Lend', icon: HandCoins },
  { href: '/trade?mode=advanced', label: 'Borrow', icon: FileSignature },
  { href: '/trade?mode=swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/stelas', label: 'Stelas', icon: Layers },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/nft', label: 'NFT', icon: Gem },
  ...(NETWORK === 'sepolia' ? [{ href: '/faucet', label: 'Faucet', icon: Droplets }] : []),
]

export function Sidebar() {
  const prefersReduced = useReducedMotion()
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('stela-sidebar-open')
    if (saved !== null) setIsOpen(saved === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('stela-sidebar-open', String(isOpen))
  }, [isOpen])

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 80 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
      className="bg-surface border-r border-border flex-col sticky top-0 h-screen z-50 hidden lg:flex"
    >
      <div className="p-10 flex items-center gap-4">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-2xl shadow-accent/20 shrink-0">
          <ShieldCheck className="text-white" size={22} />
        </div>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-xl tracking-tighter text-white"
          >
            STELA
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-6 mt-4 space-y-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} {...item} isOpen={isOpen} />
        ))}
      </nav>

      <div className="p-6 border-t border-border">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </motion.aside>
  )
}
