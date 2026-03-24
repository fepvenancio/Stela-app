import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  description?: string
  /** Optional CTA button on the right */
  cta?: { label: string; href: string }
}

export function PageHeader({ title, description, cta }: PageHeaderProps) {
  return (
    <div className={`mb-10${cta ? ' flex items-end justify-between gap-4' : ''}`}>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-chalk mb-3 uppercase">
          {title}
        </h1>
        {description && (
          <p className="text-dust max-w-lg leading-relaxed">{description}</p>
        )}
      </div>
      {cta && (
        <Button asChild variant="default" size="sm" className="shrink-0 gap-1.5 rounded-full px-5">
          <Link href={cta.href}>
            <Plus className="size-4" />
            {cta.label}
          </Link>
        </Button>
      )}
    </div>
  )
}
