import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 旧LINE時代のURLをTALKへ恒久リダイレクト（ブックマーク・通知の互換）
      { source: "/line", destination: "/talk", permanent: true },
      { source: "/line/:path*", destination: "/talk/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
