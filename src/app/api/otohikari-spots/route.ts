import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

/**
 * 今日聴いた全員の光の位置(1人1点・約5km格子集約・全件)。
 * 旧spots(人数順500件切り捨て)の「田舎の1人が消える」問題の根治。
 * 座標は3桁丸め+格子集約で軽量、エッジ5分キャッシュ — 何万人が開いても
 * DBへの問い合わせは5分に1回・転送も一定(点呼方式)。
 */
export async function GET() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/otohikari_spots_grid`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const data = res.ok ? await res.json() : [];
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json([], { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
