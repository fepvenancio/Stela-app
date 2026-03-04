import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stela/core'],
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
