import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schlankes Container-Artefakt für das eigene Dockerfile.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
