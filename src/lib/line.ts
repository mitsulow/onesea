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
  image_url?: string | null;
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
    .select("id, chat_id, sender_id, body, image_url, read_at, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as MessageRow[]) ?? [];
}

/** cursor(=最後に受け取ったcreated_at)より後の新着だけを取る（5秒ポーリングの転送量を圧縮） */
export async function fetchMessagesSince(chatId: string, sinceIso: string): Promise<MessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, body, image_url, read_at, created_at")
    .eq("chat_id", chatId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as MessageRow[]) ?? [];
}

export async function sendMessage(chatId: string, myId: string, body: string, imageUrl?: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("messages").insert({ chat_id: chatId, sender_id: myId, body, image_url: imageUrl ?? null });
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

/** ナビバッジ用: 個人チャット + グループ + 事務局お知らせの未読合計 */
export async function fetchUnreadTotal(myId: string): Promise<number> {
  const supabase = createClient();
  const [{ count }, groups, bc] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", myId),
    fetchGroups(myId).catch(() => [] as GroupSummary[]),
    fetchBroadcastSummary(myId).catch(() => null),
  ]);
  const groupUnread = groups.reduce((s, g) => s + g.unread, 0);
  return (count ?? 0) + groupUnread + (bc?.unread ?? 0);
}

/* ============ 事務局からのお知らせ（一斉送信TALK）============ */

export interface BroadcastSummary {
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface BroadcastRow {
  id: string;
  sender_id: string;
  body: string;
  audience?: string; // 'all' | 'warawa'
  created_at: string;
  profiles: (CotozuteProfile & { username: string | null }) | null;
}

/** 事務局アカウントかどうか */
export async function isTalkAdmin(myId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from("talk_admins").select("user_id").eq("user_id", myId).maybeSingle();
  return !!data;
}

/** 自分が受け取るお知らせのセグメント一覧(事務局の宛先分け) */
async function myAudiences(myId?: string | null): Promise<string[]> {
  const auds = ["all"];
  if (!myId) return auds;
  const supabase = createClient();
  const [{ data: prof }, { count: shopN }] = await Promise.all([
    supabase.from("profiles").select("warawa_until, murabito, birthday").eq("id", myId).maybeSingle(),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("owner_id", myId),
  ]);
  const isWara = !!prof?.warawa_until && new Date(prof.warawa_until as string) > new Date();
  auds.push(isWara ? "warawa" : "free");
  if (prof?.murabito) auds.push("sekai");
  if ((shopN ?? 0) > 0) auds.push("za");
  if (prof?.birthday) auds.push("tsukiyoga");
  return auds;
}

/** お知らせの最新1件と未読数（一覧のピン留め行に使う） */
export async function fetchBroadcastSummary(myId: string): Promise<BroadcastSummary> {
  const supabase = createClient();
  const [{ data: last }, { data: read }] = await Promise.all([
    supabase
      .from("broadcast_messages")
      .select("body, created_at, sender_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("broadcast_reads").select("last_read_at").eq("user_id", myId).maybeSingle(),
  ]);
  let unread = 0;
  if (last && last.sender_id !== myId) {
    const auds = await myAudiences(myId);
    let q = supabase
      .from("broadcast_messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", myId)
      .in("audience", auds);
    if (read?.last_read_at) q = q.gt("created_at", read.last_read_at);
    const { count } = await q;
    unread = count ?? 0;
  }
  return { lastBody: last?.body ?? null, lastAt: last?.created_at ?? null, unread };
}

export async function fetchBroadcasts(myId?: string): Promise<BroadcastRow[]> {
  const supabase = createClient();
  const auds = await myAudiences(myId);
  const { data } = await supabase
    .from("broadcast_messages")
    .select("id, sender_id, body, audience, created_at, profiles!broadcast_messages_sender_id_fkey(username, display_name, avatar_url)")
    .in("audience", auds)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as BroadcastRow[]) ?? [];
}

/** 事務局だけが送れる。全会員へのWeb Pushも発火する */
export async function sendBroadcast(myId: string, body: string, audience: string = "all") {
  const supabase = createClient();
  const { error } = await supabase.from("broadcast_messages").insert({ sender_id: myId, body, audience });
  if (!error && audience === "all") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        fetch("/api/broadcast-push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ body }),
        }).catch(() => {});
      }
    } catch {}
  }
  return { error };
}

export async function markBroadcastRead(myId: string) {
  const supabase = createClient();
  await supabase
    .from("broadcast_reads")
    .upsert({ user_id: myId, last_read_at: new Date().toISOString() });
  window.dispatchEvent(new Event("onesea:unreadRefresh"));
}

/* ============ グループLINE（村・部活のトークルーム）============ */

export interface GroupSummary {
  key: string; // `${type}:${id}`
  type: "village" | "club" | "neura" | "moai" | "tanbo" | "pref";
  id: string;
  name: string;
  emoji: string;
  count: number; // メンバー数（LINE風の (6) 表示用）
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
  const [vm, cm, nm, mm, tb, pr] = await Promise.all([
    supabase.from("village_members").select("village_id, villages(name)").eq("user_id", myId).eq("status", "approved"),
    supabase.from("club_members").select("club_id, clubs(name, emoji)").eq("user_id", myId),
    supabase.from("neura_members").select("team_id, neura_teams(name, prefecture, city)").eq("user_id", myId),
    supabase.from("moai_members").select("moai_id, moai(name)").eq("user_id", myId).eq("status", "approved"),
    supabase.from("tanbo_members").select("tanbo_id, tanbo(name)").eq("user_id", myId),
    supabase.from("pref_room_members").select("room_id, pref_rooms(prefecture, kind)").eq("user_id", myId),
  ]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const groups: Array<{ type: "village" | "club" | "neura" | "moai" | "tanbo" | "pref"; id: string; name: string; emoji: string }> = [
    ...((vm.data ?? []) as any[]).map((r) => ({
      type: "village" as const,
      id: r.village_id as string,
      name: (r.villages?.name as string) ?? "村",
      emoji: "🏡",
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
      name: (r.neura_teams?.name as string) ?? `ニューラ班（${(r.neura_teams?.city as string) ?? (r.neura_teams?.prefecture as string) ?? ""}）`,
      emoji: "🧠",
    })),
    ...((mm.data ?? []) as any[]).map((r) => ({
      type: "moai" as const,
      id: r.moai_id as string,
      name: (r.moai?.name as string) ?? "サークル",
      emoji: "🗿",
    })),
    ...((tb.data ?? []) as any[]).map((r) => ({
      type: "tanbo" as const,
      id: r.tanbo_id as string,
      name: (r.tanbo?.name as string) ?? "田んぼ",
      emoji: "🌾",
    })),
    ...((pr.data ?? []) as any[]).map((r) => ({
      type: "pref" as const,
      id: r.room_id as string,
      name: r.pref_rooms?.kind === "sekai"
        ? `セカイムラ${String(r.pref_rooms?.prefecture ?? "").replace(/[都府県]$/, "")}`
        : `${(r.pref_rooms?.prefecture as string) ?? ""}交流`,
      emoji: r.pref_rooms?.kind === "sekai" ? "🏡" : "🗾",
    })),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.id);
  const vIds = groups.filter((g) => g.type === "village").map((g) => g.id);
  const cIds = groups.filter((g) => g.type === "club").map((g) => g.id);
  const nIds = groups.filter((g) => g.type === "neura").map((g) => g.id);
  const mIds = groups.filter((g) => g.type === "moai").map((g) => g.id);
  const tIds = groups.filter((g) => g.type === "tanbo").map((g) => g.id);
  const pIds = groups.filter((g) => g.type === "pref").map((g) => g.id);
  const [{ data: msgs }, { data: reads }, vCnt, cCnt, nCnt, mCnt, tCnt, pCnt] = await Promise.all([
    supabase
      .from("group_messages")
      .select("scope_type, scope_id, sender_id, body, created_at")
      .in("scope_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("group_reads").select("scope_type, scope_id, last_read_at").eq("user_id", myId),
    vIds.length ? supabase.from("village_members").select("village_id").in("village_id", vIds) : Promise.resolve({ data: [] }),
    cIds.length ? supabase.from("club_members").select("club_id").in("club_id", cIds) : Promise.resolve({ data: [] }),
    nIds.length ? supabase.from("neura_members").select("team_id").in("team_id", nIds) : Promise.resolve({ data: [] }),
    mIds.length ? supabase.from("moai_members").select("moai_id").eq("status", "approved").in("moai_id", mIds) : Promise.resolve({ data: [] }),
    tIds.length ? supabase.from("tanbo_members").select("tanbo_id").in("tanbo_id", tIds) : Promise.resolve({ data: [] }),
    pIds.length ? supabase.from("pref_room_members").select("room_id").in("room_id", pIds) : Promise.resolve({ data: [] }),
  ]);
  const countBy = new Map<string, number>();
  for (const r of (vCnt.data ?? []) as Array<{ village_id: string }>) {
    const k = `village:${r.village_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  for (const r of (cCnt.data ?? []) as Array<{ club_id: string }>) {
    const k = `club:${r.club_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  for (const r of (nCnt.data ?? []) as Array<{ team_id: string }>) {
    const k = `neura:${r.team_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  for (const r of ((mCnt as { data?: Array<{ moai_id: string }> }).data ?? [])) {
    const k = `moai:${r.moai_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  for (const r of ((tCnt as { data?: Array<{ tanbo_id: string }> }).data ?? [])) {
    const k = `tanbo:${r.tanbo_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  for (const r of ((pCnt as { data?: Array<{ room_id: string }> }).data ?? [])) {
    const k = `pref:${r.room_id}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
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
        count: countBy.get(k) ?? 0,
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
    .select("id, sender_id, body, image_url, created_at, profiles!group_messages_sender_id_fkey(username, display_name, avatar_url)")
    .eq("scope_type", type)
    .eq("scope_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as unknown as GroupMessageRow[]) ?? [];
}

export async function sendGroupMessage(type: string, id: string, myId: string, body: string, imageUrl?: string | null) {
  const supabase = createClient();
  return supabase.from("group_messages").insert({ scope_type: type, scope_id: id, sender_id: myId, body, image_url: imageUrl ?? null });
}

export async function markGroupRead(type: string, id: string, myId: string) {
  const supabase = createClient();
  await supabase
    .from("group_reads")
    .upsert({ user_id: myId, scope_type: type, scope_id: id, last_read_at: new Date().toISOString() });
  window.dispatchEvent(new Event("onesea:unreadRefresh"));
}

/** グループの既読タイムスタンプ一覧(既読◯人の計算用) */
export async function fetchGroupReads(type: string, id: string): Promise<Array<{ user_id: string; last_read_at: string }>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("group_reads")
    .select("user_id, last_read_at")
    .eq("scope_type", type)
    .eq("scope_id", id);
  return (data ?? []) as Array<{ user_id: string; last_read_at: string }>;
}
