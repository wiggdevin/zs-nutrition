'use client';

import { useEffect, useState } from 'react';

interface ConfettiProps {
  duration?: number;
  particleCount?: number;
}

// Confetti colors use CSS variable references resolved at render time via getComputedStyle.
// Fallback hex values match the :root defaults in globals.css.
function getConfettiColors(): string[] {
  if (typeof window === 'undefined') {
    return ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  }
  const style = getComputedStyle(document.documentElement);
  const get = (v: string, fallback: string) => style.getPropertyValue(v).trim() || fallback;
  return [
    get('--primary', '#f97316'),
    get('--color-success', '#22c55e'),
    get('--chart-3', '#3b82f6'),
    get('--chart-4', '#a855f7'),
    get('--color-warning', '#f59e0b'),
    get('--destructive', '#ef4444'),
    '#06b6d4', // Cyan (no semantic token)
    '#ec4899', // Pink (no semantic token)
  ];
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  rotation: number;
  size: number;
}

function generateParticles(count: number): Particle[] {
  const colors = getConfettiColors();
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 1.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    size: 8 + Math.random() * 8,
  }));
}

export function Confetti({ duration = 3000, particleCount = 50 }: ConfettiProps) {
  const [particles] = useState(() => generateParticles(particleCount));
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            transform: `rotate(${particle.rotation}deg)`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
        />
      ))}
    </div>
  );
}
