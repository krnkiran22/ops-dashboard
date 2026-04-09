import type { NextConfig } from "next";

/** Default ops routes to `/v2/ops/...` unless overridden at build time (e.g. Vercel env). */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_OPS_API_GATEWAY_VERSION:
      process.env.NEXT_PUBLIC_OPS_API_GATEWAY_VERSION?.trim() || "v2",
  },
};

export default nextConfig;
