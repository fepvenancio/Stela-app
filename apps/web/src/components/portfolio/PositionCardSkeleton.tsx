import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PositionCardSkeleton() {
  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-edge/10">
        <Skeleton className="h-3 w-16 bg-surface" />
        <Skeleton className="h-5 w-14 rounded-full bg-surface" />
      </div>
      {/* Body */}
      <div className="space-y-3">
        <div>
          <Skeleton className="h-2.5 w-12 bg-surface mb-1.5" />
          <Skeleton className="h-4 w-28 bg-surface" />
        </div>
        <div>
          <Skeleton className="h-2.5 w-14 bg-surface mb-1.5" />
          <Skeleton className="h-4 w-24 bg-surface" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-2.5 w-16 bg-surface" />
          <Skeleton className="h-4 w-12 bg-surface" />
        </div>
      </div>
    </Card>
  )
}
