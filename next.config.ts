import { codeInspectorPlugin } from "code-inspector-plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
      // Only include code inspector in development
      ...codeInspectorPlugin({
        bundler: "turbopack",
      }),
    },
  },
  allowedDevOrigins: [
    "1c90-2405-4802-1d55-7ff0-9c8d-ae1c-4cc7-925.ngrok-free.app",
  ],
};

export default nextConfig;
