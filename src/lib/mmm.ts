"use client";

import { createClient } from "@/lib/supabase/client";
import type { P } from "./sekai";

/**
 * MMM (MasterMindMembers) — ニューラ活動とDDP。
 * ニューラ活動: 同じ市町村（いなければ同県）の5人1チームをランダムに組み、
 * 冬至までにお互いのDDP（短い夢）を叶え合う。
 * 自分の役割は「自分のDDPを明確に持つこと」。叶えるのは他の4人。
 */

export const NEURA_SIZE = 5;
export const NEURA_SEASON = "2026冬至";

/* ---- DDP（短い夢） ---- */
export async function fetchMyDdp(userId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.from("ddp").select("body").eq("user_id", userId).maybeSingle();
  return data?.body ?? "";
}

export async function saveMyDdp(userId: string, body: string) {
  const supabase = createClient();
  return supabase.from("ddp").upsert({ user_id: userId, body: body.trim() || null, updated_at: new Date().toISOString() });
}

/* ---- ニューラ班 ---- */
export interface NeuraMember {
  user_id: string;
  profiles: P | null;
  ddp: string | null;
}

export interface NeuraTeam {
  id: string;
  name?: string | null; // 例: 東京ひふみ（123）
  prefecture: string;
  city: string | null;
  season: string;
  members: NeuraMember[];
}

/** 自分の所属チーム（メンバーのDDP付き）。未所属なら null */
export async function myNeuraTeam(userId: string): Promise<NeuraTeam | null> {
  const supabase = createClient();
  const { data: mem } = await supabase
    .from("neura_members")
    .select("team_id, neura_teams(id, name, prefecture, city, season)")
    .eq("user_id", userId)
    .maybeSingle();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const team = (mem as any)?.neura_teams;
  if (!team) return null;
  const { data: members } = await supabase
    .from("neura_members")
    .select("user_id, profiles!neura_members_user_id_fkey(username, display_name, avatar_url)")
    .eq("team_id", team.id)
    .order("joined_at", { ascending: true });
  const ids = (members ?? []).map((m: any) => m.user_id);
  const { data: ddps } = await supabase.from("ddp").select("user_id, body").in("user_id", ids);
  const ddpBy = new Map((ddps ?? []).map((d: any) => [d.user_id, d.body as string]));
  return {
    ...team,
    members: (members ?? []).map((m: any) => ({
      user_id: m.user_id,
      profiles: m.profiles ?? null,
      ddp: ddpBy.get(m.user_id) ?? null,
    })),
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * チームに参加: 同じ市町村で空きのある班を探して入る。
 * 無ければ同県 → それも無ければ新しい班を立てる。
 */
export async function joinNeura(userId: string, prefecture: string, city: string | null): Promise<string | null> {
  const supabase = createClient();
  // 空きのある班を探す（市町村一致を優先、次に県一致）
  const { data: teams } = await supabase
    .from("neura_teams")
    .select("id, prefecture, city, neura_members(count)")
    .eq("season", NEURA_SEASON)
    .eq("prefecture", prefecture)
    .limit(50);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const open = (teams ?? []).filter((t: any) => (t.neura_members?.[0]?.count ?? 0) < NEURA_SIZE);
  const sameCity = city ? open.find((t: any) => t.city === city) : null;
  const samePref = open.find((t: any) => !city || t.city == null || t.city === city) ?? open[0];
  let teamId: string | null = (sameCity ?? samePref)?.id ?? null;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!teamId) {
    const { data: created } = await supabase
      .from("neura_teams")
      .insert({ prefecture, city, season: NEURA_SEASON })
      .select("id")
      .single();
    teamId = created?.id ?? null;
  }
  if (!teamId) return null;
  const { error } = await supabase.from("neura_members").insert({ team_id: teamId, user_id: userId });
  if (error) return null;
  return teamId;
}

export async function leaveNeura(userId: string, teamId: string) {
  const supabase = createClient();
  return supabase.from("neura_members").delete().eq("team_id", teamId).eq("user_id", userId);
}
