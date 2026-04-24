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
  allowedDevOrigins: ["765d-116-96-44-1.ngrok-free.app"],
};

export default nextConfig;
