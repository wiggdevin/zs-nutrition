const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@zero-sum/nutrition-engine'],
  // Only use outputFileTracingRoot in production builds (causes dev server issues)
  ...(process.env.NODE_ENV === 'production' ? { outputFileTracingRoot: path.join(__dirname, '../../') } : {}),
  serverExternalPackages: [],
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
}

module.exports = nextConfig
