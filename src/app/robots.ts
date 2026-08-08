import type { MetadataRoute } from "next";

/**
 * Google検索向けのクロール指示。
 * 会員専用・個人情報が絡むページは検索に載せない。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/talk", "/office", "/settings", "/notifications", "/my", "/callback"],
      },
    ],
    sitemap: "https://onesea.vercel.app/sitemap.xml",
  };
}
