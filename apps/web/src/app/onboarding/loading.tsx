import { Skeleton } from '@/components/ui/skeleton'

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
        <div className="space-y-4 pt-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}
