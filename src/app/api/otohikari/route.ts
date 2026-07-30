import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

/**
 * OTOHIKARI 集計スナップショット。
 * DB への問い合わせはエッジキャッシュ切れ時の 30 秒に 1 回だけ —
 * 利用者が何万人でも DB 負荷・転送量は一定（パケ死しない点呼方式）。
 */
export async function GET() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/otohikari_snapshot`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const data = res.ok ? await res.json() : { now: 0, today: null, spots: [] };
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { now: 0, today: null, spots: [] },
      { headers: { "Cache-Control": "public, s-maxage=10" } }
    );
  }
}
