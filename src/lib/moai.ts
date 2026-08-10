"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * MoAI（モアイ）— MMM会員もセカイムラ会員も横断で入れる、趣味でつながるサークル。
 * 拠点(村)づくりと同じ作りやすさ + イベント + 活動FEED。
 */
export interface Moai {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  icon_url: string | null;
  cover_url: string | null;
  prefecture?: string | null;
  city?: string | null;
  keywords?: string | null;
  join_policy?: string | null;
  leaders?: string[] | null;
  created_by: string;
  created_at: string;
  moai_members?: Array<{ count: number }>;
}

export const MOAI_CATEGORIES = [
  { id: "music", label: "音楽", emoji: "🎵" },
  { id: "art", label: "アート", emoji: "🎨" },
  { id: "sport", label: "スポーツ・からだ", emoji: "⚽" },
  { id: "outdoor", label: "アウトドア・自然", emoji: "🏕" },
  { id: "food", label: "食・料理", emoji: "🍳" },
  { id: "study", label: "学び・読書", emoji: "📚" },
  { id: "craft", label: "ものづくり", emoji: "🛠" },
  { id: "heal", label: "癒し・スピリチュアル", emoji: "🌙" },
  { id: "biz", label: "仕事・起業", emoji: "💼" },
  { id: "game", label: "ゲーム・IT", emoji: "🎮" },
  { id: "life", label: "暮らし", emoji: "🏠" },
  { id: "animal", label: "動物", emoji: "🐾" },
  { id: "fortune", label: "占い", emoji: "🔮" },
  { id: "history", label: "歴史", emoji: "🏯" },
  { id: "license", label: "資格取得", emoji: "📜" },
  { id: "ferment", label: "発酵", emoji: "🍶" },
  { id: "travel", label: "旅行", emoji: "✈️" },
  { id: "onsen", label: "温泉", emoji: "♨️" },
  { id: "love", label: "恋愛", emoji: "💕" },
  { id: "space", label: "宇宙", emoji: "🌌" },
  { id: "fashion", label: "ファッション", emoji: "👗" },
  { id: "other", label: "その他", emoji: "✨" },
] as const;

export const moaiCat = (id: string | null) =>
  MOAI_CATEGORIES.find((c) => c.id === id) ?? MOAI_CATEGORIES[MOAI_CATEGORIES.length - 1];

const SELECT = "id, name, category, description, keywords, join_policy, leaders, prefecture, city, icon_url, cover_url, created_by, created_at, moai_members(count)";

export async function fetchMoais(): Promise<Moai[]> {
  const supabase = createClient();
  const { data } = await supabase.from("moai").select(SELECT).order("created_at", { ascending: false });
  return (data as Moai[]) ?? [];
}

export async function fetchMoai(id: string): Promise<Moai | null> {
  const supabase = createClient();
  const { data } = await supabase.from("moai").select(SELECT).eq("id", id).maybeSingle();
  return (data as Moai) ?? null;
}

export async function createMoai(
  userId: string,
  m: { name: string; category: string; description?: string | null; keywords?: string | null; join_policy?: string; prefecture?: string | null; city?: string | null; icon_url?: string | null; cover_url?: string | null }
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("moai")
    .insert({ created_by: userId, ...m })
    .select("id")
    .single();
  if (error || !data) return null;
  // 作った人は自動で最初のメンバー
  await supabase.from("moai_members").insert({ moai_id: data.id, user_id: userId });
  return data.id;
}

export async function joinMoai(moaiId: string, userId: string, policy?: string | null) {
  const supabase = createClient();
  const status = policy === "approval" ? "pending" : "approved";
  return supabase.from("moai_members").upsert({ moai_id: moaiId, user_id: userId, status });
}

export async function leaveMoai(moaiId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("moai_members").delete().eq("moai_id", moaiId).eq("user_id", userId);
}

export async function fetchMoaiMemberIds(moaiId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("moai_members").select("user_id, status").eq("moai_id", moaiId);
  return new Set((data ?? []).filter((r: any) => r.status === "approved").map((r: any) => r.user_id as string));
}

/** 全MoAI横断の活動フィード(新しい順・イベントも含む) */
export async function fetchMoaiFeed(limit = 40) {
  const supabase = createClient();
  const { data } = await supabase
    .from("moai_posts")
    .select("id, moai_id, body, photo_url, kind, event_at, created_at, user_id, moai!moai_posts_moai_id_fkey(id, name, icon_url, category, prefecture), profiles!moai_posts_user_id_fkey(username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function updateMoai(id: string, m: { name?: string; category?: string; description?: string | null; keywords?: string | null; join_policy?: string; prefecture?: string | null; city?: string | null }) {
  const supabase = createClient();
  return supabase.from("moai").update(m).eq("id", id);
}

export async function deleteMoai(id: string) {
  const supabase = createClient();
  return supabase.from("moai").delete().eq("id", id);
}

/** 部員のプロフィール(アイコン列用・先頭50人) */
export async function fetchMoaiMembers(moaiId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("moai_members")
    .select("user_id, joined_at, profiles!moai_members_user_id_fkey(username, display_name, avatar_url)")
    .eq("moai_id", moaiId)
    .order("joined_at", { ascending: true })
    .limit(50);
  return (data ?? []).map((r: any) => ({ ...r.profiles, user_id: r.user_id })).filter((x: any) => x && x.user_id);
}

export async function fetchMoaiComments(postIds: string[]) {
  if (!postIds.length) return {} as Record<string, any[]>;
  const supabase = createClient();
  const { data } = await supabase
    .from("moai_post_comments")
    .select("id, post_id, user_id, body, created_at, profiles!moai_post_comments_user_id_fkey(username, display_name, avatar_url)")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });
  const map: Record<string, any[]> = {};
  for (const c of data ?? []) (map[c.post_id] = map[c.post_id] ?? []).push(c);
  return map;
}

export async function addMoaiComment(postId: string, userId: string, body: string) {
  const supabase = createClient();
  return supabase.from("moai_post_comments").insert({ post_id: postId, user_id: userId, body: body.trim() });
}

/** 同名のMoAIが既にあるか(大文字小文字・前後空白を無視) */
export async function moaiNameTaken(name: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.rpc("moai_name_taken", { nm: name });
  return data === true;
}

/** 承認待ちの申請者(承認制サークルのOYA用) */
export async function fetchMoaiPending(moaiId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("moai_members")
    .select("user_id, profiles!moai_members_user_id_fkey(username, display_name, avatar_url)")
    .eq("moai_id", moaiId).eq("status", "pending");
  return (data ?? []).map((r: any) => ({ ...r.profiles, user_id: r.user_id })).filter((x: any) => x.user_id);
}
export async function approveMoaiMember(moaiId: string, userId: string) {
  const supabase = createClient();
  return supabase.rpc("moai_decide", { p_moai: moaiId, p_user: userId, p_approve: true });
}
export async function rejectMoaiMember(moaiId: string, userId: string) {
  const supabase = createClient();
  return supabase.rpc("moai_decide", { p_moai: moaiId, p_user: userId, p_approve: false });
}
export async function myMoaiStatus(moaiId: string, userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("moai_members").select("status").eq("moai_id", moaiId).eq("user_id", userId).maybeSingle();
  return data?.status ?? null;
}
