import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for containerized deployments (Vercel/Docker)
  output: 'standalone',
};

export default nextConfig;
