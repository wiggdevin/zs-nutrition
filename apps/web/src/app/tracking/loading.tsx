import { Skeleton } from '@/components/ui/skeleton'

export default function TrackingLoading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}
