'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSwipeNavigationOptions {
  totalDays: number;
  initialDay?: number;
}

export function useSwipeNavigation({ totalDays, initialDay }: UseSwipeNavigationOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentDay, setCurrentDay] = useState(initialDay ?? 0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const hasInitialScrolled = useRef(false);

  // Sync currentDay from scroll position on snap settle
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || totalDays === 0) return;
    const childWidth = el.scrollWidth / totalDays;
    if (childWidth === 0) return;
    const idx = Math.round(el.scrollLeft / childWidth);
    setCurrentDay(Math.max(0, Math.min(idx, totalDays - 1)));
  }, [totalDays]);

  const scrollToDay = useCallback(
    (dayIndex: number) => {
      const el = scrollRef.current;
      if (!el || totalDays === 0) return;
      const clamped = Math.max(0, Math.min(dayIndex, totalDays - 1));
      const childWidth = el.scrollWidth / totalDays;
      el.scrollTo({ left: clamped * childWidth, behavior: 'smooth' });
      setCurrentDay(clamped);
    },
    [totalDays]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    // Only count as swipe if horizontal movement exceeds vertical
    if (dx > dy && dx > 10) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = 50;
      if (Math.abs(dx) > threshold) {
        if (dx < 0) {
          scrollToDay(currentDay + 1);
        } else {
          scrollToDay(currentDay - 1);
        }
      }
    },
    [currentDay, scrollToDay]
  );

  // Re-sync on resize (viewport changes)
  useEffect(() => {
    const handler = () => handleScroll();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [handleScroll]);

  // Scroll to initialDay when data loads (watches initialDay to handle async data)
  useEffect(() => {
    if (initialDay === undefined || initialDay <= 0 || hasInitialScrolled.current) {
      return;
    }

    // useState(initialDay) only works on first render — sync state now
    setCurrentDay(initialDay);
    hasInitialScrolled.current = true;

    const el = scrollRef.current;
    if (!el) return;

    // Double rAF ensures browser has completed layout before scrolling
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const child = el.children[initialDay] as HTMLElement | undefined;
        if (child) {
          child.scrollIntoView({
            behavior: 'instant' as ScrollBehavior,
            block: 'nearest',
            inline: 'start',
          });
        }
      });
    });
  }, [initialDay]);

  return {
    scrollRef,
    currentDay,
    setCurrentDay: scrollToDay,
    handleScroll,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
