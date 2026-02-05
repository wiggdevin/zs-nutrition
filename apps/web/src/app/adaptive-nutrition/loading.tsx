import { Skeleton } from '@/components/ui/skeleton'

export default function AdaptiveNutritionLoading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}
