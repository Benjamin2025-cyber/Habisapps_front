import type { NextConfig } from "next";

const apiOrigin = process.env.HABIS_API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  // Note: rewrites() is evaluated at build time, so HABIS_API_ORIGIN is baked
  // into the bundle during `next build` (passed as a Docker build arg).
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
