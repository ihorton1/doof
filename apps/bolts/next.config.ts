import type { NextConfig } from "next";
import path from "node:path";
import { BASE_PATH } from "./src/lib/paths";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: BASE_PATH,
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
