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
};

export default nextConfig;
