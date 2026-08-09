"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * MOAI（モアイ）— MMM会員もセカイムラ会員も横断で入れる、趣味でつながるサークル。
 * 拠点(村)づくりと同じ作りやすさ + イベント + 活動FEED。
 */
export interface Moai {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  icon_url: string | null;
  cover_url: string | null;
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
  { id: "other", label: "その他", emoji: "✨" },
] as const;

export const moaiCat = (id: string | null) =>
  MOAI_CATEGORIES.find((c) => c.id === id) ?? MOAI_CATEGORIES[MOAI_CATEGORIES.length - 1];

const SELECT = "id, name, category, description, icon_url, cover_url, created_by, created_at, moai_members(count)";

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
  m: { name: string; category: string; description?: string | null; icon_url?: string | null; cover_url?: string | null }
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

export async function joinMoai(moaiId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("moai_members").upsert({ moai_id: moaiId, user_id: userId });
}

export async function leaveMoai(moaiId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("moai_members").delete().eq("moai_id", moaiId).eq("user_id", userId);
}

export async function fetchMoaiMemberIds(moaiId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("moai_members").select("user_id").eq("moai_id", moaiId);
  return new Set((data ?? []).map((r) => r.user_id as string));
}
