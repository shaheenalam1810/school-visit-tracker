/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    // Rewrites lucide-react's barrel import into per-icon imports so
    // each page's bundle only includes the icons it actually uses.
    optimizePackageImports: ["lucide-react"],
  },
};

module.exports = nextConfig;
