/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
      bodySizeLimit: '2mb',
    },
    typedRoutes: true,
  },
  serverExternalPackages: ['pdf-parse'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('canvas');
    }
    return config;
  },
};

module.exports = nextConfig;
