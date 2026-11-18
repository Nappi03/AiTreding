/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@prisma/client',
    'prisma',
    'node-cron',
    'technicalindicators',
    'yahoo-finance2',
  ],
  experimental: {
    // Allows background tasks / cron setup on server start
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
