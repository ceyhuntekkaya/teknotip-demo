import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  async redirects() {
    return [
      {
        source: "/data-json",
        destination: "/products",
        permanent: true,
      },
      {
        source: "/musteriler",
        destination: "/customers",
        permanent: true,
      },
      {
        source: "/musteriler/:path*",
        destination: "/customers/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
