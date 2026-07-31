import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";

/**
 * LINEの新着をチャット相手にWeb Pushで届ける。
 * SWが受け取ってホーム画面アイコンのバッジ（未読数）と通知を更新する。
 * 認可: 送信者のアクセストークンを検証し、そのチャットの当事者だけが叩ける。
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

  const { chatId, body } = (await req.json()) as { chatId?: string; body?: string };
  if (!chatId || !body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: chat } = await admin.from("chats").select("a, b").eq("id", chatId).maybeSingle();
  if (!chat || (chat.a !== sender.id && chat.b !== sender.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const to = chat.a === sender.id ? chat.b : chat.a;

  // 受信者の未読合計（本人のチャットに限定して数える）
  const { data: chatRows } = await admin.from("chats").select("id").or(`a.eq.${to},b.eq.${to}`);
  const chatIds = (chatRows ?? []).map((c) => c.id);
  let unread = 1;
  if (chatIds.length > 0) {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("chat_id", chatIds)
      .is("read_at", null)
      .neq("sender_id", to);
    unread = count ?? 1;
  }

  const [{ data: prof }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", sender.id).maybeSingle(),
    admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", to),
  ]);
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  webpush.setVapidDetails("mailto:mitsulow@gmail.com", VAPID_PUBLIC_KEY, priv);
  const payload = JSON.stringify({
    title: prof?.display_name ?? "OneSea",
    body: body.length > 60 ? body.slice(0, 60) + "…" : body,
    badge: unread,
    url: `/line/${chatId}`,
    tag: `line-${chatId}`,
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 失効した購読は掃除
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return NextResponse.json({ ok: true, sent });
}
