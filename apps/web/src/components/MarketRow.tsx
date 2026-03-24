import { UtilizationBar } from './UtilizationBar'

interface MarketRowProps {
  symbol: string
  totalLent: string
  lendApy: string
  borrowApy: string
  utilization: number
}

export function MarketRow({ symbol, totalLent, lendApy, borrowApy, utilization }: MarketRowProps) {
  return (
    <div className="grid grid-cols-5 gap-8 p-8 items-center hover:bg-white/[0.02] transition-all rounded-[2rem] border border-transparent hover:border-border group">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-border group-hover:border-accent/20 transition-colors font-bold text-xs text-gray-500">
          {symbol[0]}
        </div>
        <span className="font-bold text-base text-white tracking-tight">{symbol}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-white tracking-tighter font-mono">{totalLent}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Total Lent</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-green-500 tracking-tighter font-mono">{lendApy}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Lend APY</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-orange-500 tracking-tighter font-mono">{borrowApy}</span>
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Borrow APY</span>
      </div>
      <div className="flex flex-col items-end">
        <UtilizationBar percent={utilization} />
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-2">{utilization}% Utilized</span>
      </div>
    </div>
  )
}
