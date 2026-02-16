import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Disable static page generation for build
    ppr: false,
  },
};

export default nextConfig;
