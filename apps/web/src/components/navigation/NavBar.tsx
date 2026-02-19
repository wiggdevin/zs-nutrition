'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState, useEffect, useRef, useCallback } from 'react';

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
    label: 'Chat',
    href: '/chat',
    icon: (active: boolean) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
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

const primaryNavItems = navItems.slice(0, 3); // Dashboard, Plan, Track
const secondaryNavItems = navItems.slice(3); // Activity, Adaptive, Settings

function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={`w-9 h-9 ${className ?? ''}`} />;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors ${className ?? ''}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isSecondaryActive = secondaryNavItems.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + '/')
  );

  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Close the "More" panel when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

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
            {'///'}
          </span>
          <span className="font-black text-sm uppercase tracking-wider text-primary">Zero Sum</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
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

        {/* Desktop theme toggle */}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile: "More" backdrop */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile: "More" slide-up panel */}
      <div
        ref={panelRef}
        className={`md:hidden fixed left-0 right-0 z-50 transition-transform duration-200 ease-out ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: '4rem' }}
      >
        <div className="mx-3 mb-2 rounded-xl border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
          <div className="flex flex-col gap-1">
            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMore}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
            <div className="border-t border-border mt-1 pt-1">
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground">
                <ThemeToggle />
                <span>Theme</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom"
        data-testid="mobile-nav"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {primaryNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
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

          {/* More button */}
          <button
            onClick={() => setMoreOpen((prev) => !prev)}
            data-testid="nav-more"
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 min-w-[60px] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
              moreOpen || isSecondaryActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-expanded={moreOpen}
            aria-label="More navigation options"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={moreOpen || isSecondaryActive ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={moreOpen || isSecondaryActive ? 0 : 1.5}
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="2" />
              <circle cx="4" cy="12" r="2" />
              <circle cx="20" cy="12" r="2" />
            </svg>
            <span
              className={`text-[10px] font-medium ${moreOpen || isSecondaryActive ? 'font-bold' : ''}`}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
