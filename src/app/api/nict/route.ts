import { NextResponse } from "next/server";

/**
 * NICT宇宙天気予報センターの「きょうの概況」(日本語・人間が書く本物の予報文)。
 * 例: 「太陽活動は静穏でした。…プロミネンス放出が観測されました。…」
 * CORS回避のためのプロキシ。30分エッジキャッシュで転送・負荷は一定。
 */
export async function GET() {
  try {
    const r = await fetch("https://swc.nict.go.jp/data/api/report-ja-daily-latest.json", {
      headers: { "user-agent": "OneSea/1.0" },
      cache: "no-store",
    });
    const j = await r.json();
    const item = j?.items?.[0] ?? {};
    return NextResponse.json(
      { updated: item.updated ?? null, summary: item.summary ?? null },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  } catch {
    return NextResponse.json({ updated: null, summary: null }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}
