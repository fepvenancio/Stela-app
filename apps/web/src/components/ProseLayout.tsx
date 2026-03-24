import { PageHeader } from '@/components/PageHeader'

interface ProseLayoutProps {
  title: string
  description?: string
  lastUpdated?: string
  children: React.ReactNode
}

export function ProseLayout({ title, description, lastUpdated, children }: ProseLayoutProps) {
  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <PageHeader title={title} description={description} />
      {lastUpdated && (
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-8">
          Last updated: {lastUpdated}
        </p>
      )}
      <div className="prose-container space-y-10">
        {children}
      </div>
    </div>
  )
}

interface ProseSectionProps {
  title: string
  children: React.ReactNode
}

export function ProseSection({ title, children }: ProseSectionProps) {
  return (
    <section>
      <h3 className="font-bold text-lg text-white uppercase tracking-widest mb-4 flex items-center gap-3">
        <div className="w-1.5 h-1.5 bg-accent rotate-45" />
        {title}
      </h3>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}
