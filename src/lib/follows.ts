import { createClient } from "@/lib/supabase/client";

/**
 * フォロー — フィードの「おススメ順」の土台。
 * おススメ順 = ①まだ見ていない投稿 ②フォローしている人 ③いいねが多い ④新しい、の順で並べる。
 * 「一回見たら次は下がる」ために、表示済みIDを端末に覚える（seen）。
 * 投稿が少ないうちは、結局ぜんぶ並ぶので取りこぼしなし。
 */

let cachedFollowees: { uid: string; set: Set<string> } | null = null;

export async function fetchFollowees(userId: string): Promise<Set<string>> {
  if (cachedFollowees?.uid === userId) return cachedFollowees.set;
  const supabase = createClient();
  const { data } = await supabase.from("follows").select("followee").eq("follower", userId).limit(2000);
  const set = new Set<string>((data ?? []).map((r) => r.followee as string));
  cachedFollowees = { uid: userId, set };
  return set;
}

export async function toggleFollow(userId: string, targetId: string, following: boolean): Promise<void> {
  const supabase = createClient();
  if (following) {
    await supabase.from("follows").delete().eq("follower", userId).eq("followee", targetId);
    cachedFollowees?.set.delete(targetId);
  } else {
    await supabase.from("follows").insert({ follower: userId, followee: targetId });
    cachedFollowees?.set.add(targetId);
  }
}

export async function fetchFollowingProfiles(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("follows")
    .select("followee, profiles!follows_followee_fkey(id, username, display_name, avatar_url)")
    .eq("follower", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
}

/* ---- 表示済み(seen)の記憶 ---- */
const SEEN_KEY = "ctz-seen";

export function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function markSeen(ids: string[]) {
  try {
    const s = seenSet();
    ids.forEach((i) => s.add(i));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-800)));
  } catch {}
}

/**
 * おススメ順に並べ替える。
 * 未読が先。未読の中では フォロー中 → いいね数 → 新しさ。既読は後ろに同じ順で。
 * 投稿が少なければ全部並ぶ（隠さない）。
 */
export function rankPosts<T extends { id: string; user_id: string; created_at: string; likes?: Array<{ count: number }> }>(
  posts: T[],
  followees: Set<string>,
  seen: Set<string>
): T[] {
  const likeN = (p: T) => p.likes?.[0]?.count ?? 0;
  const score = (p: T) => {
    let sc = 0;
    if (!seen.has(p.id)) sc += 1_000_000; // 未読が最優先
    if (followees.has(p.user_id)) sc += 100_000; // フォローしている人
    sc += Math.min(likeN(p), 99) * 1000; // いいね数
    sc += Math.max(0, 999 - Math.floor((Date.now() - new Date(p.created_at).getTime()) / 3600e3)); // 新しさ(時間単位)
    return sc;
  };
  return [...posts].sort((a, b) => score(b) - score(a));
}
