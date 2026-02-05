import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  eslint: {
    // ESLint is run separately via `pnpm lint` - don't block builds
    // This allows the build to complete while CI enforces lint rules
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@zero-sum/nutrition-engine'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: [],
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
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

              // Allow scripts from self, inline (needed for Next.js), and Clerk
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com",

              // Allow styles from self and inline (needed for styled-components, Tailwind, etc.)
              "style-src 'self' 'unsafe-inline'",

              // Allow images from self, data URIs, blobs, and Clerk
              "img-src 'self' blob: data: https://*.clerk.com https://img.clerk.com",

              // Allow fonts from self, data URIs, and Google Fonts
              "font-src 'self' data: https://fonts.gstatic.com",

              // Allow connections to self, Clerk, and Anthropic API
              "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.com https://api.anthropic.com",

              // Allow frames from Clerk for OAuth
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",

              // Restrict form submissions to self
              "form-action 'self'",

              // Only load from self for base URI
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
