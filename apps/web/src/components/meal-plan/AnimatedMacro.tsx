'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedMacroProps {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedMacro({
  target,
  suffix = '',
  decimals = 0,
  duration = 800,
  className = '',
}: AnimatedMacroProps) {
  const [display, setDisplay] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!animatedRef.current) {
      setDisplay(0);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          const start = performance.now();

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            const value = eased * target;
            setDisplay(
              decimals > 0 ? Math.round(value * 10 ** decimals) / 10 ** decimals : Math.round(value)
            );
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, decimals]);

  return (
    <span ref={ref} className={className}>
      {decimals > 0 ? display.toFixed(decimals) : display}
      {suffix}
    </span>
  );
}
