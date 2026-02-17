import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import bundleAnalyzer from '@next/bundle-analyzer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

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

          // Content Security Policy (relaxed in dev for hot reload)
          ...(isDev
            ? []
            : [
                {
                  key: 'Content-Security-Policy',
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.zerosumnutrition.com",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' blob: data: https://*.clerk.com https://img.clerk.com https://clerk.zerosumnutrition.com",
                    "font-src 'self' data: https://fonts.gstatic.com",
                    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.com https://api.anthropic.com https://clerk-telemetry.com https://clerk.zerosumnutrition.com",
                    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://accounts.zerosumnutrition.com",
                    "worker-src 'self' blob:",
                    "form-action 'self'",
                    "base-uri 'self'",
                  ].join('; '),
                },
              ]),
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
