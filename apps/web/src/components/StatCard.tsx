import type { LucideIcon } from 'lucide-react'

type StatColor = 'accent' | 'green' | 'orange' | 'purple'

interface StatCardProps {
  title: string
  value: string
  subValue?: string
  icon: LucideIcon
  color: StatColor
}

const colorMap: Record<StatColor, { glow: string; iconBg: string; iconText: string }> = {
  accent:  { glow: 'bg-blue-500/5',   iconBg: 'bg-blue-500/10',   iconText: 'text-blue-500' },
  green:   { glow: 'bg-green-500/5',   iconBg: 'bg-green-500/10',   iconText: 'text-green-500' },
  orange:  { glow: 'bg-orange-500/5',  iconBg: 'bg-orange-500/10',  iconText: 'text-orange-500' },
  purple:  { glow: 'bg-purple-500/5',  iconBg: 'bg-purple-500/10',  iconText: 'text-purple-500' },
}

export function StatCard({ title, value, subValue, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="bg-surface p-8 rounded-[2rem] border border-border flex flex-col gap-4 group hover:border-accent/20 transition-all duration-500 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 ${c.glow} blur-[60px] -translate-y-1/2 translate-x-1/2`} />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-micro">{title}</span>
        <div className={`p-2.5 rounded-xl ${c.iconBg} border border-white/5`}>
          <Icon size={18} className={c.iconText} />
        </div>
      </div>
      <div className="flex flex-col relative z-10">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">{value}</span>
        {subValue && (
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">{subValue}</span>
        )}
      </div>
    </div>
  )
}
