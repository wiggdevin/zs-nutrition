'use client';

import dynamic from 'next/dynamic';

const PlasmaBackground = dynamic(
  () => import('./PlasmaBackground').then((mod) => ({ default: mod.PlasmaBackground })),
  { ssr: false }
);

export function PlasmaBackgroundLoader() {
  return <PlasmaBackground />;
}
