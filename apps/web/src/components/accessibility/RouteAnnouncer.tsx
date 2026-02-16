'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Small delay to let the page title update
    const timer = setTimeout(() => {
      const title = document.title?.split('|')[0]?.trim() || 'Page loaded';
      setAnnouncement(`Navigated to ${title}`);
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
      {announcement}
    </div>
  );
}
