import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@architech/shared', '@architech/db', '@architech/ai'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
