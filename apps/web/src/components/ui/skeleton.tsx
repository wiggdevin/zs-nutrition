import { HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The animation style for the skeleton
   * @default 'shimmer'
   */
  animation?: 'shimmer' | 'pulse' | 'none'

  /**
   * The background color variant
   * @default 'default'
   */
  variant?: 'default' | 'light' | 'dark'
}

/**
 * Skeleton loading placeholder component with dark theme support.
 *
 * Features:
 * - Shimmer animation: Subtle gradient shine moving left to right
 * - Pulse animation: Opacity-based fade effect
 * - Dark theme optimized colors with proper contrast
 *
 * @example
 * // Basic usage
 * <Skeleton className="h-4 w-32" />
 *
 * // With pulse animation
 * <Skeleton animation="pulse" className="h-12 w-full" />
 *
 * // Circle skeleton for avatars
 * <Skeleton className="h-10 w-10 rounded-full" />
 */
export function Skeleton({
  className = '',
  animation = 'shimmer',
  variant = 'default',
  ...props
}: SkeletonProps) {
  // Color variants optimized for dark theme
  const baseColors = {
    default: 'bg-card',
    light: 'bg-border',
    dark: 'bg-background',
  }

  const animationClasses = {
    shimmer: 'skeleton-shimmer',
    pulse: 'skeleton-pulse',
    none: '',
  }

  const combinedClassName = [
    'rounded-md',
    baseColors[variant],
    animationClasses[animation],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={combinedClassName} {...props} aria-hidden="true" />
}
