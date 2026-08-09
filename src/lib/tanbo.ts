"use client";

import { createClient } from "@/lib/supabase/client";

/** 田んぼ=ページ(拠点・MOAIと同じ作り)のデータ層 */
export interface TanboPage {
  id: string;
  name: string;
  prefecture: string | null;
  note: string | null;
  photo_url: string | null;
  cover_url: string | null;
  icon_url: string | null;
  year: number | null;
  detail?: Record<string, string> | null;
  user_id: string;
  created_at: string;
}

export async function fetchTanboPage(id: string): Promise<TanboPage | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tanbo")
    .select("id, name, prefecture, note, photo_url, cover_url, icon_url, year, user_id, created_at, detail")
    .eq("id", id)
    .maybeSingle();
  return (data as TanboPage) ?? null;
}

export async function joinTanbo(tanboId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("tanbo_members").upsert({ tanbo_id: tanboId, user_id: userId });
}

export async function leaveTanbo(tanboId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("tanbo_members").delete().eq("tanbo_id", tanboId).eq("user_id", userId);
}

export async function fetchTanboMemberIds(tanboId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("tanbo_members").select("user_id").eq("tanbo_id", tanboId);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

/** 部員のプロフィール(アイコン列用・先頭50人) */
export async function fetchTanboMembers(tanboId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("tanbo_members")
    .select("user_id, joined_at, profiles!tanbo_members_user_id_fkey(username, display_name, avatar_url)")
    .eq("tanbo_id", tanboId)
    .order("joined_at", { ascending: true })
    .limit(50);
  return (data ?? []).map((r: any) => ({ ...r.profiles, user_id: r.user_id })).filter((x: any) => x && x.user_id);
}

export async function updateTanboPage(id: string, t: { name?: string; prefecture?: string; note?: string | null }) {
  const supabase = createClient();
  return supabase.from("tanbo").update(t).eq("id", id);
}

export async function deleteTanboPage(id: string) {
  const supabase = createClient();
  return supabase.from("tanbo").delete().eq("id", id);
}

export async function fetchTanboComments(postIds: string[]) {
  if (!postIds.length) return {} as Record<string, any[]>;
  const supabase = createClient();
  const { data } = await supabase
    .from("tanbo_post_comments")
    .select("id, post_id, user_id, body, created_at, profiles!tanbo_post_comments_user_id_fkey(username, display_name, avatar_url)")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });
  const map: Record<string, any[]> = {};
  for (const c of data ?? []) (map[c.post_id] = map[c.post_id] ?? []).push(c);
  return map;
}

export async function addTanboComment(postId: string, userId: string, body: string) {
  const supabase = createClient();
  return supabase.from("tanbo_post_comments").insert({ post_id: postId, user_id: userId, body: body.trim() });
}
