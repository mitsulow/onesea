import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";

/**
 * 毎晩 21:36 JST（Vercel Cron: 36 12 * * * UTC）。
 * 今日のDDPを書いた人に「何％叶いましたか？」のプッシュを送る。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!priv || !sr) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const admin = createClient(SUPABASE_URL, sr, { auth: { persistSession: false } });

  // 今日(JST)のDDPを書いた人だけに送る
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: ddps } = await admin.from("daily_ddp").select("user_id, body").eq("day", day);
  if (!ddps || ddps.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const ids = ddps.map((d) => d.user_id);
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", ids);
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  webpush.setVapidDetails("mailto:mitsulow@gmail.com", VAPID_PUBLIC_KEY, priv);
  const bodyBy = new Map(ddps.map((d) => [d.user_id, d.body as string]));

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const ddp = (bodyBy.get(s.user_id) ?? "").slice(0, 40);
      const payload = JSON.stringify({
        title: "今日のDDPは、何％叶いましたか？",
        body: `「${ddp}」— 叶った度をマイページで記そう`,
        url: "/my",
        tag: "ddp-check",
      });
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
  return NextResponse.json({ ok: true, sent });
}
