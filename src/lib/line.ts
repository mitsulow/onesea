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

/** ナビバッジ用: 全チャットの未読合計 */
export async function fetchUnreadTotal(myId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", myId);
  return count ?? 0;
}
