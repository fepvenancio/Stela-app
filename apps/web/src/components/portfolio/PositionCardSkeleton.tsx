import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PositionCardSkeleton() {
  return (
    <Card className="p-6 rounded-3xl">
      <CardHeader className="p-0 pb-4 gap-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20 bg-surface" />
          <Skeleton className="h-5 w-16 rounded-full bg-surface" />
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-4 pt-4">
        <Skeleton className="h-4 w-full bg-surface" />
        <Skeleton className="h-4 w-full bg-surface" />
        <Skeleton className="h-4 w-3/4 bg-surface" />
        <Skeleton className="h-4 w-1/2 bg-surface" />
      </CardContent>
      <CardFooter className="p-0 pt-4">
        <Skeleton className="h-3 w-16 bg-surface" />
      </CardFooter>
    </Card>
  )
}
