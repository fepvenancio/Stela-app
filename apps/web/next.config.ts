import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stela/core'],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }
    return config
  },
}

export default nextConfig
