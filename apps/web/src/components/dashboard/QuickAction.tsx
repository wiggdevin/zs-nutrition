import React from 'react';
import Link from 'next/link';

export interface QuickActionProps {
  icon: string;
  label: string;
  href: string;
  variant?: 'default' | 'primary';
}

export const QuickAction = React.memo(function QuickAction({
  icon,
  label,
  href,
  variant = 'default',
}: QuickActionProps) {
  const isPrimary = variant === 'primary';
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex items-center gap-3 px-5 py-3 card-elevation border rounded-xl transition-all duration-200 group ${
        isPrimary
          ? 'border-primary/40 bg-primary/5 hover:border-primary/60'
          : 'border-border hover:border-primary/30'
      }`}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span
        className={`text-sm font-semibold uppercase tracking-wide transition-colors ${
          isPrimary ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        }`}
      >
        {label}
      </span>
    </Link>
  );
});
