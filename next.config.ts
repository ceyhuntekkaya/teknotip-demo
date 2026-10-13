import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
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
      {
        source: "/users",
        destination: "/settings/users",
        permanent: false,
      },
      {
        source: "/users/:path*",
        destination: "/settings/users",
        permanent: false,
      },
      {
        source: "/organized-products",
        destination: "/settings/organized-products",
        permanent: false,
      },
      {
        source: "/organized-products/:path*",
        destination: "/settings/organized-products",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
