import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";

/**
 * 事務局からのお知らせを全会員にWeb Pushで届ける。
 * 認可: talk_admins に載っているアカウントだけが叩ける。
 */
export async function POST(req: NextRequest) {
  const priv = process.env.VAPID_PRIVATE_KEY;
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!priv || !srKey) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, srKey, { auth: { persistSession: false } });
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  const sender = userData?.user;
  if (authErr || !sender) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: isAdmin } = await admin.from("talk_admins").select("user_id").eq("user_id", sender.id).maybeSingle();
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { body } = (await req.json()) as { body?: string };
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .neq("user_id", sender.id);
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  webpush.setVapidDetails("mailto:mitsulow@gmail.com", VAPID_PUBLIC_KEY, priv);
  const payload = JSON.stringify({
    title: "📢 OneSea事務局",
    body: body.length > 80 ? body.slice(0, 80) + "…" : body,
    url: "/line/broadcast",
    tag: "broadcast",
  });

  // 大人数でも詰まらないよう50件ずつ順に送る
  let sent = 0;
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(
      subs.slice(i, i + 50).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      })
    );
  }
  return NextResponse.json({ ok: true, sent });
}
