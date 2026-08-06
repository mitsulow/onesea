import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";

/**
 * わらわ〜会員（プレミアム）を付与する。warawa_until はDBトリガーで
 * サービスロール以外からの書き換えが封じられているため、ここ（service_role）でだけ更新できる。
 *
 * ⚠️ 現在は「模擬」: ログイン済みならLPの模擬決済ボタンから付与する。
 *    本番では Stripe webhook の決済確認を挟み、確認できた顧客だけに付与するよう
 *    このルートを差し替える（ログインだけで通す now の分岐を削除する）。
 */
export async function POST(req: NextRequest) {
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srKey) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, srKey, { auth: { persistSession: false } });
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const until = new Date();
  until.setFullYear(until.getFullYear() + 1); // 年会費: 1年分
  const { error } = await admin
    .from("profiles")
    .update({ warawa_until: until.toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "update failed" }, { status: 502 });

  return NextResponse.json({ ok: true, warawa_until: until.toISOString() });
}
