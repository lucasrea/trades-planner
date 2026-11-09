import type { NextConfig } from "next";
import { securityHeaders } from "./lib/http/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
};

export default nextConfig;
