import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

// Wire Cloudflare bindings (D1, etc.) into `next dev` so `getCloudflareContext()`
// works locally — used by the auth routes and /api/d1/health. No-op in prod builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
