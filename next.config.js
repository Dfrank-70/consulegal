/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Next.js 15 configuration optimized for Tailwind CSS
  experimental: {
    // Server actions configuration
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
      bodySizeLimit: '2mb'
    },
    // CSS optimization
    optimizeCss: false, // Temporarily disabled for debugging
    // Improved type safety for routes
    typedRoutes: true,
  },

  // Ensure styles are processed correctly
  webpack: (config) => {
    return config;
  },
}

module.exports = nextConfig
