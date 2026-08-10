/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared TS packages (they ship raw source, no build step).
  transpilePackages: ['@apecheck/core', '@apecheck/api-clients', '@apecheck/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // token logos come from arbitrary hosts
    ],
  },
  eslint: {
    // Keep builds unblocked on lint during early dev.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
