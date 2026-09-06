import type { NextConfig } from "next";

// Fail the build early rather than at first request if the environment is wrong.
import "./src/env/server";

const config: NextConfig = {
  reactStrictMode: true,
  // @m4/db ships TypeScript sources; Next.js has to transpile them itself.
  transpilePackages: ["@m4/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
