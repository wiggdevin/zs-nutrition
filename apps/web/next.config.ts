import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import bundleAnalyzer from '@next/bundle-analyzer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@zero-sum/nutrition-engine', '@zsn/queue-config'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'sharp'],
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },

  // Package import optimization for better tree-shaking
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@clerk/nextjs',
      '@tanstack/react-query',
      '@radix-ui/react-slot',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-select',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-progress',
      'date-fns',
      'zod',
      'sonner',
      'class-variance-authority',
    ],
  },

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Security headers for all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks
          { key: 'X-Frame-Options', value: 'DENY' },

          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // Enforce HTTPS (HSTS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },

          // Disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },

          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              // Default to self for anything not explicitly set
              "default-src 'self'",

              // Allow scripts from self, inline (needed for Next.js hydration), and Clerk
              "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.zerosumnutrition.com",

              // Allow styles from self and inline (needed for styled-components, Tailwind, etc.)
              "style-src 'self' 'unsafe-inline'",

              // Allow images from self, data URIs, blobs, and Clerk
              "img-src 'self' blob: data: https://*.clerk.com https://img.clerk.com https://clerk.zerosumnutrition.com",

              // Allow fonts from self, data URIs, and Google Fonts
              "font-src 'self' data: https://fonts.gstatic.com",

              // Allow connections to self, Clerk, Anthropic API, and Clerk telemetry
              "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.com https://api.anthropic.com https://clerk-telemetry.com https://clerk.zerosumnutrition.com",

              // Allow frames from Clerk for OAuth
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://accounts.zerosumnutrition.com",

              // Allow workers from self and blob (needed for Clerk)
              "worker-src 'self' blob:",

              // Restrict form submissions to self
              "form-action 'self'",

              // Only load from self for base URI
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
