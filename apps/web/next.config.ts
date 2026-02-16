import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@obralink/shared', '@obralink/db', '@obralink/ai'],
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
