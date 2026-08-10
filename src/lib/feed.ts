"use client";

import { createClient } from "@/lib/supabase/client";
import type { CotozutePost } from "./cotozute";
import type { Shop } from "./za";

/**
 * Cotozute統合フィード — 属性の違う3つの媒体を1本の無限スクロールに混ぜる。
 * ① Cotozute（言の葉）② むらびとたより（セカイムラの拠点投稿）③ 楽市楽座（出品）
 * 時間カーソル1本で3テーブルを引き、時系列に混ぜて返す。
 */

export interface MuraPost {
  id: string;
  body: string;
  photo_url: string | null;
  kind: string | null;
  embed?: { url: string; title?: string; description?: string; image?: string; platform?: string } | null;
  event_at: string | null;
  created_at: string;
  user_id: string;
  villages: { id: string; name: string; prefecture: string | null; icon_url?: string | null } | null;
  /** 県ページ(セカイムラ◯◯)からの投稿の場合に入る */
  pref_rooms?: { id: string; prefecture: string; icon_url?: string | null } | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null; member_no?: number | null; warawa_until?: string | null } | null;
}

export interface MoaiFeedPost {
  id: string;
  body: string;
  photo_url: string | null;
  kind: string | null;
  created_at: string;
  user_id: string;
  moai: { id: string; name: string; icon_url: string | null; category: string | null } | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export type FeedItem =
  | { kind: "coto"; at: string; post: CotozutePost }
  | { kind: "mura"; at: string; mura: MuraPost }
  | { kind: "shop"; at: string; shop: Shop }
  | { kind: "moai"; at: string; moaiPost: MoaiFeedPost };

export function feedKey(it: FeedItem): string {
  return it.kind + ":" + (it.kind === "coto" ? it.post.id : it.kind === "mura" ? it.mura.id : it.kind === "moai" ? it.moaiPost.id : it.shop.id);
}

const POST_SELECT =
  "id, user_id, body, image_urls, thumb_urls, embed, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url, member_no, warawa_until), likes(count), comments(count)";
const MURA_SELECT =
  "id, body, photo_url, kind, event_at, embed, created_at, user_id, villages!village_posts_village_id_fkey(id, name, prefecture, icon_url), pref_rooms!village_posts_pref_room_id_fkey(id, prefecture, icon_url), profiles!village_posts_user_id_fkey(username, display_name, avatar_url)";
const SHOP_SELECT =
  "id, owner_id, name, description, price_jpy, is_trial, accepts_barter, accepts_tip, category, market, image_urls, thumb_urls, created_at, profiles!shops_owner_id_fkey(username, display_name, avatar_url), shop_comments(count)";

/** cursor（ISO時刻）より古いものを混ぜて取得（言の葉+むらびとたより。出品は横スクロールへ分離） */
export async function fetchMixedFeed(cursor: string | null, limit = 20): Promise<FeedItem[]> {
  const supabase = createClient();

  let qP = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(limit);
  let qM = supabase.from("village_posts").select(MURA_SELECT).order("created_at", { ascending: false }).limit(limit);
  let qMo = supabase.from("moai_posts").select("id, body, photo_url, kind, created_at, user_id, moai!moai_posts_moai_id_fkey(id, name, icon_url, category), profiles!moai_posts_user_id_fkey(username, display_name, avatar_url)").eq("kind", "normal").order("created_at", { ascending: false }).limit(limit);
  if (cursor) {
    qP = qP.lt("created_at", cursor);
    qM = qM.lt("created_at", cursor);
    qMo = qMo.lt("created_at", cursor);
  }
  const [p, m, mo] = await Promise.all([qP, qM, qMo]);
  const sh = { data: [] as unknown[] };

  // これからのイベントは上のストーリー欄に出るので、フィードからは除外（重複防止）。
  // 終わったイベントは記録としてフィードに残る。
  const nowIso = new Date().toISOString();
  const muraRows = (((m.data ?? []) as unknown) as MuraPost[]).filter(
    (x) => !(x.kind === "event" && x.event_at && x.event_at >= nowIso)
  );
  const items: FeedItem[] = [
    ...(((p.data ?? []) as unknown) as CotozutePost[]).map(
      (post): FeedItem => ({ kind: "coto", at: post.created_at, post })
    ),
    ...muraRows.map((mura): FeedItem => ({ kind: "mura", at: mura.created_at, mura })),
    ...(((mo.data ?? []) as unknown) as MoaiFeedPost[]).map((moaiPost): FeedItem => ({ kind: "moai", at: moaiPost.created_at, moaiPost })),
    ...(((sh.data ?? []) as unknown) as Shop[]).map(
      (shop): FeedItem => ({ kind: "shop", at: shop.created_at, shop })
    ),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}

/** 楽市楽座の最新出品（横スクロールストリップ用） */
export async function fetchLatestShops(limit = 10): Promise<Shop[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shops")
    .select(SHOP_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown) as Shop[];
}

/* ---- ストーリーズ（24時間で消える・写真1枚） ---- */
export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export async function fetchStories(): Promise<Story[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data } = await supabase
    .from("stories")
    .select("id, user_id, image_url, created_at, profiles!stories_user_id_fkey(username, display_name, avatar_url)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as unknown) as Story[];
}

export async function addStory(userId: string, imageUrl: string) {
  const supabase = createClient();
  return supabase.from("stories").insert({ user_id: userId, image_url: imageUrl });
}

export async function deleteStory(id: string, userId: string) {
  const supabase = createClient();
  return supabase.from("stories").delete().eq("id", id).eq("user_id", userId);
}

/** いいねした人の顔（FB風・投稿ごとに最大3人） */
export async function fetchLikersFor(
  postIds: string[]
): Promise<Record<string, Array<{ avatar_url: string | null; display_name: string | null }>>> {
  if (!postIds.length) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("likes")
    .select("post_id, profiles!likes_user_id_fkey(avatar_url, display_name)")
    .in("post_id", postIds)
    .limit(postIds.length * 6);
  const map: Record<string, Array<{ avatar_url: string | null; display_name: string | null }>> = {};
  for (const r of (data ?? []) as unknown as Array<{ post_id: string; profiles: { avatar_url: string | null; display_name: string | null } | null }>) {
    if (!r.profiles) continue;
    (map[r.post_id] = map[r.post_id] ?? []).length < 3 && map[r.post_id].push(r.profiles);
  }
  return map;
}
