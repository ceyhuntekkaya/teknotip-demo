import type { NextConfig } from "next";

const apiUrl = (process.env.API_URL ?? "http://localhost:8080/api").replace(
  /\/$/,
  "",
);

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
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
