/**
 * Brand constants for PDF templates.
 * Single source of truth — all templates import from here.
 */

export const BRAND = {
  primary: '#f97316',
  primaryDark: '#ea580c',
  primaryLightBg: '#fff7ed',
  foreground: '#1a1a2e',
  muted: '#64748b',
  cardBg: '#f8f9fa',
  border: '#e2e8f0',
  calories: '#f97316',
  protein: '#22c55e',
  carbs: '#3b82f6',
  fat: '#a855f7',
  trainingDay: '#f59e0b',
  restDay: '#3b82f6',
} as const;

export const FONTS = {
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  heading: "'Archivo Black', 'Inter', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
} as const;

export const GOOGLE_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">`;

/**
 * Generate the ZS-MAC logo as pure CSS HTML.
 */
export function logoHtml(size: 'sm' | 'md' = 'md'): string {
  const dim = size === 'sm' ? 32 : 40;
  const fontSize = size === 'sm' ? 11 : 14;
  const textSize = size === 'sm' ? 16 : 20;
  return `<div style="display:inline-flex;align-items:center;gap:10px;">
  <div style="width:${dim}px;height:${dim}px;background:${BRAND.primary};border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <span style="color:white;font-family:${FONTS.heading};font-size:${fontSize}px;letter-spacing:1px;">ZS</span>
  </div>
  <span style="font-family:${FONTS.heading};font-size:${textSize}px;color:${BRAND.foreground};letter-spacing:2px;">ZS-MAC</span>
</div>`;
}

/**
 * Generate a `/// LABEL` styled section label (monospace, uppercase, orange).
 */
export function sectionLabel(text: string): string {
  return `<span style="font-family:${FONTS.mono};font-size:11px;font-weight:600;color:${BRAND.primary};text-transform:uppercase;letter-spacing:2px;">/// ${text}</span>`;
}
