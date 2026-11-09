import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Step 10 builds this with OpenNext for Lambda; "standalone" bundles only the files the server needs.
  output: "standalone",
};

export default nextConfig;
