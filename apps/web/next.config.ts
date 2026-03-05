import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stela/core'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.cartridge.gg https://*.alchemy.com https://*.starknet.io wss://*.starknet.io https://sepolia.voyager.online https://voyager.online",
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
    ]
  },
}

export default nextConfig
