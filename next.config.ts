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
    ];
  },
};

export default nextConfig;
