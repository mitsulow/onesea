import { createClient } from "@/lib/supabase/client";
import { getOrCreateChat, sendMessage } from "@/lib/line";

/** ともだちシステム（2026-08-13）。
 *  名刺交換（QR/オンライン）→ ともだち申請 → 相手のTALKに申請カードが届く →
 *  「ともだちになる / 今はならない」で応答。承認で ともだち成立。
 *  マイページの「ともだち」一覧は accepted の両方向。 */

export const FRIEND_REQ_MARK = "[[friend-request:";

export interface FriendProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** TALKメッセージ本文から申請IDを取り出す（申請カード描画用） */
export function parseFriendRequestId(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/\[\[friend-request:([0-9a-f-]{36})\]\]/);
  return m ? m[1] : null;
}

/** 申請を送る（名刺交換後に呼ぶ）。TALKに申請カードのメッセージも送る */
export async function sendFriendRequest(myId: string, otherId: string): Promise<"sent" | "already" | "error"> {
  if (!myId || !otherId || myId === otherId) return "error";
  const supabase = createClient();
  const { data: ex } = await supabase
    .from("friend_requests")
    .select("id, status, from_user")
    .or(`and(from_user.eq.${myId},to_user.eq.${otherId}),and(from_user.eq.${otherId},to_user.eq.${myId})`);
  if ((ex ?? []).some((r) => r.status === "accepted" || r.status === "pending")) return "already";

  let reqId: string | null = null;
  const { data: row, error } = await supabase
    .from("friend_requests")
    .insert({ from_user: myId, to_user: otherId })
    .select("id")
    .single();
  if (row) reqId = row.id;
  if (error) {
    // 過去にdeclinedされたペア → pendingに戻して再申請
    const { data: upd } = await supabase
      .from("friend_requests")
      .update({ status: "pending", responded_at: null })
      .eq("from_user", myId)
      .eq("to_user", otherId)
      .select("id")
      .maybeSingle();
    if (!upd) return "error";
    reqId = upd.id;
  }
  try {
    const chatId = await getOrCreateChat(myId, otherId);
    if (chatId && reqId) {
      await sendMessage(chatId, myId, `${FRIEND_REQ_MARK}${reqId}]] ともだちの申請が届いています`);
    }
  } catch { /* TALK通知に失敗しても申請自体は生きている */ }
  return "sent";
}

export async function fetchRequest(reqId: string): Promise<{ id: string; status: string; from_user: string; to_user: string } | null> {
  const supabase = createClient();
  const { data } = await supabase.from("friend_requests").select("id, status, from_user, to_user").eq("id", reqId).maybeSingle();
  return data ?? null;
}

/** 申請に応答（承認/見送り）。to_user本人だけがRLSで通る */
export async function respondFriendRequest(reqId: string, accept: boolean): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", reqId);
  return !error;
}

/** ともだち一覧（accepted・両方向） */
export async function fetchFriends(userId: string): Promise<FriendProfile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("friend_requests")
    .select("from_user, to_user")
    .eq("status", "accepted")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`)
    .limit(500);
  const ids = [...new Set((data ?? []).map((r) => (r.from_user === userId ? r.to_user : r.from_user)))];
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
  return (profs as FriendProfile[]) ?? [];
}

/** フォローされている人（followers） */
export async function fetchFollowerProfiles(userId: string): Promise<FriendProfile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("follows")
    .select("follower, profiles!follows_follower_fkey(id, username, display_name, avatar_url)")
    .eq("followee", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
}
