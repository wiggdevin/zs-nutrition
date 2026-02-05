'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Onboarding error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">
        Something went wrong during setup. Please try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
