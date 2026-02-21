import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function InscriptionCardSkeleton() {
  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-0 gap-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20 bg-surface" />
          <Skeleton className="h-5 w-14 rounded-full bg-surface" />
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-3 pt-4">
        <Skeleton className="h-4 w-full bg-surface" />
        <Skeleton className="h-4 w-full bg-surface" />
        <Skeleton className="h-4 w-2/3 bg-surface" />
      </CardContent>
      <CardFooter className="p-0 pt-4">
        <Skeleton className="h-3 w-24 bg-surface" />
      </CardFooter>
    </Card>
  )
}
