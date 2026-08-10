import { createClient } from "@/lib/supabase/client";

/**
 * 統合お知らせ（🔔）。DBトリガーが notifications に自動で積む:
 *  cotozute_comment / village_reply / shop_comment / barter_offer / share
 * （ハートは通知しない方針）
 */
export interface NotificationRow {
  id: string;
  actor_id: string | null;
  kind: string;
  target_url: string | null;
  excerpt: string | null;
  created_at: string;
  read_at: string | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export function notifText(n: NotificationRow): string {
  const who = n.profiles?.display_name ?? "どなたか";
  switch (n.kind) {
    case "cotozute_comment":
      return `${who}さんからCotozute投稿にコメントが来ています`;
    case "village_reply":
      return `${who}さんがセカイムラ投稿に返信しました`;
    case "shop_comment":
      return `${who}さんが楽市楽座の出品にコメントしました`;
    case "barter_offer":
      return `${who}さんからブツブツ交換の提案が来ました`;
    case "share":
      return `${who}さんにシェアされました`;
    case "club_post":
      return `${who}さんが部活に活動記録を投稿しました`;
    case "like":
      return `記事にハートが付きました`;
    case "follow":
      return `${who}さんにフォローされました`;
    case "meishi":
      return `📇 ${who}さんと名刺交換しました！お互いフォローになり、TalKで話せます`;
    case "quest_call":
      return `あなたのスキルが呼ばれています！「この指とまれ」に旗が立ちました`;
    case "quest_pick":
      return `${who}さんに指名されました🌸「この人が欲しい♪」`;
    case "quest_join":
      return `${who}さんが花いちもんめの仲間になりました`;
    case "moai_approved":
      return `サークルへの入部が承認されました🎉`;
    case "moai_rejected":
      return `サークルへの入部は今回は見送りになりました`;
    case "village_approved":
      return `拠点への入村が承認されました🎉`;
    case "village_rejected":
      return `拠点への入村は今回は見送りになりました`;
    case "moai_post":
      return `参加中のサークルに新しい活動報告があります`;
    case "moai_event":
      return `参加中のサークルに新しいイベントが立ちました📅`;
    case "moai_oya":
      return `サークルのOYA（部長）に任命されました👑`;
    case "story_like":
      return `${who}さんがあなたのストーリーズに💓しました`;
    default:
      return `${who}さんからお知らせがあります`;
  }
}

export async function fetchNotifications(userId: string, limit = 60): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, actor_id, kind, target_url, excerpt, created_at, read_at, profiles!notifications_actor_id_fkey(username, display_name, avatar_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as NotificationRow[]) ?? [];
}

export async function fetchNotifUnread(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/** 個別既読: 見た(タップした)お知らせだけを既読にする */
export async function markNotifRead(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids)
    .is("read_at", null);
}

export async function markNotifsRead(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
