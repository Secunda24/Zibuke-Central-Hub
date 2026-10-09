import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
