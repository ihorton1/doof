import type { NextConfig } from "next";
import path from "node:path";

const devOrigins = process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  ...(devOrigins && devOrigins.length > 0
    ? { allowedDevOrigins: devOrigins }
    : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
