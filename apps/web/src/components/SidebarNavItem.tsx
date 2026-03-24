'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'

interface SidebarNavItemProps {
  href: string
  label: string
  icon: LucideIcon
  isOpen: boolean
  /** Match active state by this path instead of href (for query-param routes) */
  activePath?: string
}

export function SidebarNavItem({ href, label, icon: Icon, isOpen, activePath }: SidebarNavItemProps) {
  const pathname = usePathname()
  const matchPath = activePath ?? href
  const active = matchPath === '/' ? pathname === '/' : pathname === matchPath

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 group relative ${
        active
          ? 'bg-white/[0.03] text-white'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
      }`}
    >
      <Icon size={18} className={active ? 'text-accent' : 'text-gray-500 group-hover:text-gray-300'} />
      {isOpen && <span className="font-semibold text-xs uppercase tracking-[0.1em]">{label}</span>}
      {active && (
        <motion.div
          layoutId="active-nav"
          className="absolute left-0 w-1 h-6 bg-accent rounded-r-full"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  )
}
