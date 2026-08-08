import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // シューマン音などの音声: 1年ブラウザキャッシュ(SW非対応環境の保険。ファイル差し替え時は名前を変える)
        source: "/audio/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async redirects() {
    return [
      // 旧LINE時代のURLをTALKへ恒久リダイレクト（ブックマーク・通知の互換）
      { source: "/line", destination: "/talk", permanent: true },
      { source: "/line/:path*", destination: "/talk/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
