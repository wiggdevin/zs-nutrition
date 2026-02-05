import { Skeleton } from '@/components/ui/skeleton'

export default function MealPlanLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-7 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-12 w-40 mx-auto rounded-lg" />
      </div>
    </div>
  )
}
