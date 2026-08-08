import type { MetadataRoute } from "next";

/** 検索に載せたい公開ページの地図。新しい入り口ページを作ったらここに足す */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://onesea.vercel.app";
  const pages: Array<[string, number]> = [
    ["/", 1],
    ["/join", 0.9],
    ["/lp/onesea", 0.9],
    ["/lp/tsukiyoga", 0.8],
    ["/lp/sekai", 0.8],
    ["/lp/mmm", 0.8],
    ["/lp/za", 0.8],
    ["/cotozute", 0.7],
    ["/sekai", 0.7],
    ["/za", 0.7],
    ["/mmm", 0.7],
    ["/tsukiyoga", 0.7],
    ["/schumann1/", 0.6],
    ["/about", 0.5],
    ["/privacy", 0.3],
    ["/terms", 0.3],
  ];
  return pages.map(([path, priority]) => ({
    url: base + path,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority,
  }));
}
