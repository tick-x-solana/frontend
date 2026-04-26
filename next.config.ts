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
  allowedDevOrigins: ["84b0-116-96-44-1.ngrok-free.app"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nysm.work",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
