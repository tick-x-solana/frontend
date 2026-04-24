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
      ...codeInspectorPlugin({
        bundler: "turbopack",
      }),
    },
  },
  allowedDevOrigins: [
    "160b-2401-d800-fe70-6810-b42d-c20e-44a1-7931.ngrok-free.app",
  ],
};

export default nextConfig;
