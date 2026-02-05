import { Skeleton } from '@/components/ui/skeleton'

export default function GenerateLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-80 mx-auto" />
        <div className="space-y-4 pt-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 w-48 mx-auto rounded-xl" />
      </div>
    </div>
  )
}
