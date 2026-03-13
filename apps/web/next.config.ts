import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@stela/core'],
  serverExternalPackages: ['ws'],
  async headers() {
    return [
      // Fingerprinted static assets (immutable — Next.js adds content hash)
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Public assets (icons, OG images, etc.)
      {
        source: '/(.+\\.(?:ico|svg|png|jpg|jpeg|webp|avif|woff2?)$)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // HTML pages — short cache with revalidation
      {
        source: '/((?!api/).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      // API routes — no browser cache, CDN can cache briefly
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.cartridge.gg https://x.cartridge.gg https://*.alchemy.com https://*.starknet.io wss://*.starknet.io https://sepolia.voyager.online https://voyager.online https://www.google-analytics.com https://www.googletagmanager.com",
              "frame-src https://x.cartridge.gg",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), camera=(), microphone=(), payment=()',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/order/:id',
        destination: '/stela/:id',
        permanent: true,
      },
      {
        source: '/inscription/:id',
        destination: '/stela/:id',
        permanent: true,
      },
      {
        source: '/stelas',
        destination: '/markets',
        permanent: true,
      },
      {
        source: '/inscribe',
        destination: '/borrow',
        permanent: true,
      },
      {
        source: '/genesis',
        destination: '/nft',
        permanent: true,
      },
      {
        source: '/genesis/claim',
        destination: '/nft/claim',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
