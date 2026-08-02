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
  event_at: string | null;
  created_at: string;
  user_id: string;
  villages: { id: string; name: string; prefecture: string | null } | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null; member_no?: number | null } | null;
}

export type FeedItem =
  | { kind: "coto"; at: string; post: CotozutePost }
  | { kind: "mura"; at: string; mura: MuraPost }
  | { kind: "shop"; at: string; shop: Shop };

export function feedKey(it: FeedItem): string {
  return it.kind + ":" + (it.kind === "coto" ? it.post.id : it.kind === "mura" ? it.mura.id : it.shop.id);
}

const POST_SELECT =
  "id, user_id, body, image_urls, thumb_urls, embed, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url, member_no), likes(count), comments(count)";
const MURA_SELECT =
  "id, body, photo_url, kind, event_at, created_at, user_id, villages!village_posts_village_id_fkey(id, name, prefecture), profiles!village_posts_user_id_fkey(username, display_name, avatar_url)";
const SHOP_SELECT =
  "id, owner_id, name, description, price_jpy, is_trial, accepts_barter, accepts_tip, category, market, image_urls, thumb_urls, created_at, profiles!shops_owner_id_fkey(username, display_name, avatar_url), shop_comments(count)";

/** cursor（ISO時刻）より古いものを3媒体から混ぜて取得。cursor=null で最新から */
export async function fetchMixedFeed(cursor: string | null, limit = 20): Promise<FeedItem[]> {
  const supabase = createClient();

  let qP = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(limit);
  let qM = supabase.from("village_posts").select(MURA_SELECT).order("created_at", { ascending: false }).limit(limit);
  let qS = supabase.from("shops").select(SHOP_SELECT).order("created_at", { ascending: false }).limit(limit);
  if (cursor) {
    qP = qP.lt("created_at", cursor);
    qM = qM.lt("created_at", cursor);
    qS = qS.lt("created_at", cursor);
  }
  const [p, m, sh] = await Promise.all([qP, qM, qS]);

  const items: FeedItem[] = [
    ...(((p.data ?? []) as unknown) as CotozutePost[]).map(
      (post): FeedItem => ({ kind: "coto", at: post.created_at, post })
    ),
    ...(((m.data ?? []) as unknown) as MuraPost[]).map(
      (mura): FeedItem => ({ kind: "mura", at: mura.created_at, mura })
    ),
    ...(((sh.data ?? []) as unknown) as Shop[]).map(
      (shop): FeedItem => ({ kind: "shop", at: shop.created_at, shop })
    ),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}
