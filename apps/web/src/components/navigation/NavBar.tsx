'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        {!active && <path d="M9 22V12h6v10" />}
      </svg>
    ),
  },
  {
    label: 'Plan',
    href: '/meal-plan',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        {!active && (
          <>
            <path d="M9 12h6" />
            <path d="M9 16h6" />
          </>
        )}
      </svg>
    ),
  },
  {
    label: 'Track',
    href: '/tracking',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    label: 'Activity',
    href: '/activity',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: 'Adaptive',
    href: '/adaptive-nutrition',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: Top navigation bar */}
      <nav
        className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-14 items-center border-b border-border bg-background/95 backdrop-blur-sm px-6"
        data-testid="desktop-nav"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 mr-8">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            ///
          </span>
          <span className="font-black text-sm uppercase tracking-wider text-primary">Zero Sum</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1" role="tablist">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                role="tab"
                aria-selected={!!isActive}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                {item.icon(!!isActive)}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile: Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom"
        data-testid="mobile-nav"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16 px-2" role="tablist">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                role="tab"
                aria-selected={!!isActive}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 min-w-[60px] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.icon(!!isActive)}
                <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
