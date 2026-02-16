import React from 'react';
import Link from 'next/link';

export interface QuickActionProps {
  icon: string;
  label: string;
  href: string;
}

export const QuickAction = React.memo(function QuickAction({
  icon,
  label,
  href,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center gap-3 px-5 py-3 card-elevation border border-border rounded-xl hover:border-primary/30 transition-all duration-200 group"
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </Link>
  );
});
