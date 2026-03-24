export function UtilizationBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden border border-white/5">
      <div
        className="bg-accent h-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}
