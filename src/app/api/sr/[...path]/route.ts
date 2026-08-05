import { NextRequest, NextResponse } from "next/server";

/**
 * 観測データの回覧板（0Lei GitHub Pages のプロキシ）。
 * 何万人が開いても、0Leiへの取りに行きは「5分に1回」だけになる。
 * 観測は15分に1回しか更新されないので、5分キャッシュで鮮度は落ちない。
 */
const ORIGIN = "https://mitsulow.github.io/0Lei/";
const ALLOW = [
  "schumann_data.json",
  "schumann_history.json",
  "graph_stats.json",
  "schumann_series_3d.json",
  "schumann_series.json",
  "history/daily_summary.json",
  "history/solar_daily.json",
];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = (path ?? []).join("/");
  if (!ALLOW.includes(rel) && !/^history\/\d{4}-\d{2}(\.daily)?\.json$/.test(rel)) {
    return NextResponse.json({ error: "not allowed" }, { status: 404 });
  }
  try {
    const r = await fetch(ORIGIN + rel, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "upstream " + r.status }, { status: 502 });
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // ブラウザは毎回エッジに聞きに来るが、エッジは5分間同じコピーを配る
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
