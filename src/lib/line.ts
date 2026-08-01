"use client";

import { createClient } from "@/lib/supabase/client";
import type { CotozuteProfile } from "./cotozute";

export interface ChatRow {
  id: string;
  a: string;
  b: string;
  last_message_at: string | null;
  pa: CotozuteProfile | null;
  pb: CotozuteProfile | null;
}

export interface ChatSummary {
  id: string;
  partner: CotozuteProfile & { id: string };
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const CHAT_SELECT =
  "id, a, b, last_message_at, pa:profiles!chats_a_fkey(username, display_name, avatar_url), pb:profiles!chats_b_fkey(username, display_name, avatar_url)";

/** 相手とのチャットを取得（無ければ作る） */
export async function getOrCreateChat(myId: string, otherId: string): Promise<string | null> {
  const supabase = createClient();
  const [a, b] = [myId, otherId].sort();
  const { data: existing } = await supabase
    .from("chats")
    .select("id")
    .eq("a", a)
    .eq("b", b)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("chats").insert({ a, b }).select("id").single();
  if (error) return null;
  return data.id;
}

/** 自分のトーク一覧（相手・最新メッセージ・未読数つき） */
export async function fetchChats(myId: string): Promise<ChatSummary[]> {
  const supabase = createClient();
  const { data: chats } = await supabase
    .from("chats")
    .select(CHAT_SELECT)
    .or(`a.eq.${myId},b.eq.${myId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const rows = (chats as unknown as ChatRow[]) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.id);
  const [{ data: lasts }, { data: unreads }] = await Promise.all([
    supabase
      .from("messages")
      .select("chat_id, body, created_at")
      .in("chat_id", ids)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("messages")
      .select("chat_id")
      .in("chat_id", ids)
      .is("read_at", null)
      .neq("sender_id", myId),
  ]);
  const lastBy = new Map<string, { body: string; created_at: string }>();
  for (const m of lasts ?? []) {
    if (!lastBy.has(m.chat_id)) lastBy.set(m.chat_id, m);
  }
  const unreadBy = new Map<string, number>();
  for (const m of unreads ?? []) {
    unreadBy.set(m.chat_id, (unreadBy.get(m.chat_id) ?? 0) + 1);
  }

  return rows.map((c) => {
    const partnerIsA = c.b === myId;
    const partner = (partnerIsA ? c.pa : c.pb) ?? {
      username: null,
      display_name: "むらびと",
      avatar_url: null,
    };
    const last = lastBy.get(c.id);
    return {
      id: c.id,
      partner: { ...partner, id: partnerIsA ? c.a : c.b },
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? c.last_message_at,
      unread: unreadBy.get(c.id) ?? 0,
    };
  });
}

export async function fetchMessages(chatId: string): Promise<MessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, body, read_at, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as MessageRow[]) ?? [];
}

export async function sendMessage(chatId: string, myId: string, body: string) {
  const supabase = createClient();
  const { error } = await supabase.from("messages").insert({ chat_id: chatId, sender_id: myId, body });
  if (!error) {
    await supabase.from("chats").update({ last_message_at: new Date().toISOString() }).eq("id", chatId);
    // 相手のホーム画面バッジ・通知を更新（失敗しても本文送信には影響させない）
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ chatId, body }),
        }).catch(() => {});
      }
    } catch {}
  }
  return { error };
}

/** 相手からの未読を既読にする */
export async function markRead(chatId: string, myId: string) {
  const supabase = createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .is("read_at", null)
    .neq("sender_id", myId);
  window.dispatchEvent(new Event("onesea:unreadRefresh"));
}

/** ナビバッジ用: 個人チャット + グループの未読合計 */
export async function fetchUnreadTotal(myId: string): Promise<number> {
  const supabase = createClient();
  const [{ count }, groups] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", myId),
    fetchGroups(myId).catch(() => [] as GroupSummary[]),
  ]);
  const groupUnread = groups.reduce((s, g) => s + g.unread, 0);
  return (count ?? 0) + groupUnread;
}

/* ============ グループLINE（村・部活のトークルーム）============ */

export interface GroupSummary {
  key: string; // `${type}:${id}`
  type: "village" | "club" | "neura";
  id: string;
  name: string;
  emoji: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface GroupMessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: (CotozuteProfile & { username: string | null }) | null;
}

/** 自分が入っている村・部活のグループ一覧（最新メッセージ・未読つき） */
export async function fetchGroups(myId: string): Promise<GroupSummary[]> {
  const supabase = createClient();
  const [vm, cm, nm] = await Promise.all([
    supabase.from("village_members").select("village_id, villages(name)").eq("user_id", myId),
    supabase.from("club_members").select("club_id, clubs(name, emoji)").eq("user_id", myId),
    supabase.from("neura_members").select("team_id, neura_teams(prefecture, city)").eq("user_id", myId),
  ]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const groups: Array<{ type: "village" | "club" | "neura"; id: string; name: string; emoji: string }> = [
    ...((vm.data ?? []) as any[]).map((r) => ({
      type: "village" as const,
      id: r.village_id as string,
      name: (r.villages?.name as string) ?? "村",
      emoji: "⛺",
    })),
    ...((cm.data ?? []) as any[]).map((r) => ({
      type: "club" as const,
      id: r.club_id as string,
      name: (r.clubs?.name as string) ?? "部活",
      emoji: (r.clubs?.emoji as string) ?? "🎌",
    })),
    ...((nm.data ?? []) as any[]).map((r) => ({
      type: "neura" as const,
      id: r.team_id as string,
      name: `ニューラ班（${(r.neura_teams?.city as string) ?? (r.neura_teams?.prefecture as string) ?? ""}）`,
      emoji: "🧠",
    })),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.id);
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    supabase
      .from("group_messages")
      .select("scope_type, scope_id, sender_id, body, created_at")
      .in("scope_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("group_reads").select("scope_type, scope_id, last_read_at").eq("user_id", myId),
  ]);
  const readBy = new Map((reads ?? []).map((r) => [`${r.scope_type}:${r.scope_id}`, r.last_read_at as string]));
  const lastBy = new Map<string, { body: string; created_at: string }>();
  const unreadBy = new Map<string, number>();
  for (const m of msgs ?? []) {
    const k = `${m.scope_type}:${m.scope_id}`;
    if (!lastBy.has(k)) lastBy.set(k, m);
    const lr = readBy.get(k);
    if (m.sender_id !== myId && (!lr || m.created_at > lr)) unreadBy.set(k, (unreadBy.get(k) ?? 0) + 1);
  }
  return groups
    .map((g) => {
      const k = `${g.type}:${g.id}`;
      const last = lastBy.get(k);
      return {
        ...g,
        key: k,
        lastBody: last?.body ?? null,
        lastAt: last?.created_at ?? null,
        unread: unreadBy.get(k) ?? 0,
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function fetchGroupMessages(type: string, id: string): Promise<GroupMessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_messages")
    .select("id, sender_id, body, created_at, profiles!group_messages_sender_id_fkey(username, display_name, avatar_url)")
    .eq("scope_type", type)
    .eq("scope_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as GroupMessageRow[]) ?? [];
}

export async function sendGroupMessage(type: string, id: string, myId: string, body: string) {
  const supabase = createClient();
  return supabase.from("group_messages").insert({ scope_type: type, scope_id: id, sender_id: myId, body });
}

export async function markGroupRead(type: string, id: string, myId: string) {
  const supabase = createClient();
  await supabase
    .from("group_reads")
    .upsert({ user_id: myId, scope_type: type, scope_id: id, last_read_at: new Date().toISOString() });
  window.dispatchEvent(new Event("onesea:unreadRefresh"));
}
