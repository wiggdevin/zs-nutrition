import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  label?: string;
  showPrefix?: boolean;
  actions?: React.ReactNode;
  sticky?: boolean;
  maxWidth?: '2xl' | '4xl' | '7xl' | 'screen-2xl' | 'full';
  className?: string;
  'data-testid'?: string;
}

const maxWidthMap = {
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '7xl': 'max-w-7xl',
  'screen-2xl': 'max-w-7xl xl:max-w-screen-2xl',
  full: 'max-w-[1600px]',
} as const;

export function PageHeader({
  title,
  subtitle,
  label,
  showPrefix = false,
  actions,
  sticky = false,
  maxWidth,
  className,
  'data-testid': testId,
}: PageHeaderProps) {
  // Section-level header: has label, sticky, maxWidth, or actions → full border/padding wrapper
  const isSection = !!(label || sticky || maxWidth || actions);

  if (!isSection) {
    // Inline header: just the heading elements with bottom margin
    return (
      <div className={cn('mb-6', className)} data-testid={testId}>
        <h1 className="text-2xl font-heading uppercase tracking-wider text-foreground">
          {showPrefix && <span className="text-primary">{'///'} </span>}
          {title}
        </h1>
        {subtitle && (
          <p className="hidden md:block text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-b border-border bg-background px-4 py-3',
        sticky && 'sticky top-0 md:top-14 z-40 bg-background/80 backdrop-blur-sm',
        className
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          'mx-auto',
          maxWidth ? maxWidthMap[maxWidth] : undefined,
          actions && 'flex items-center justify-between gap-4'
        )}
      >
        <div>
          {label && (
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {'/// '}
              {label}
            </p>
          )}
          <h1
            className={cn(
              'text-2xl font-heading uppercase tracking-wider text-foreground',
              label && 'mt-1'
            )}
          >
            {showPrefix && <span className="text-primary">{'///'} </span>}
            {title}
          </h1>
          {subtitle && (
            <p className="hidden md:block text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
