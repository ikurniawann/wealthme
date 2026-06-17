import { config } from "dotenv";
import path from "node:path";
import type { NextConfig } from "next";

// Load the repo-root .env when running locally (pnpm dev / next build).
// No `override: true` — injected container ENV (or existing process.env) always wins.
// Silently no-ops when the file is absent (e.g. pure-env Docker runtime).
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  // Required for Docker: bundles server + deps into .next/standalone.
  output: "standalone",
};

export default nextConfig;
