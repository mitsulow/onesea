"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface CotozuteProfile {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CotozutePost {
  id: string;
  user_id: string;
  body: string;
  image_urls: string[] | null;
  thumb_urls: string[] | null;
  embed: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    platform?: string;
  } | null;
  created_at: string;
  profiles: CotozuteProfile | null;
  likes: Array<{ count: number }>;
  comments: Array<{ count: number }>;
}

export interface CotozuteComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: CotozuteProfile | null;
}

const POST_SELECT =
  "id, user_id, body, image_urls, thumb_urls, embed, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url), likes(count), comments(count)";

/** ページ単位で取得（メモリ保護のため一度に全件は読まない） */
export async function fetchPostsPage(offset: number, limit = 20): Promise<CotozutePost[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data as unknown as CotozutePost[]) ?? [];
}

export async function fetchPosts(username?: string): Promise<CotozutePost[]> {
  const supabase = createClient();
  let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(30);
  if (username) {
    const { data: prof } = await supabase.from("profiles").select("id").eq("username", username).single();
    if (!prof) return [];
    q = q.eq("user_id", prof.id);
  }
  const { data } = await q;
  return (data as unknown as CotozutePost[]) ?? [];
}

export async function fetchPost(id: string): Promise<CotozutePost | null> {
  const supabase = createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).single();
  return (data as unknown as CotozutePost) ?? null;
}

export async function fetchComments(postId: string): Promise<CotozuteComment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("comments")
    .select("id, user_id, body, created_at, profiles!comments_user_id_fkey(username, display_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data as unknown as CotozuteComment[]) ?? [];
}

export async function fetchMyLikes(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("likes").select("post_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.post_id as string));
}

export async function toggleLike(postId: string, userId: string, liked: boolean): Promise<void> {
  const supabase = createClient();
  if (liked) {
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: userId });
  }
}

export async function addComment(postId: string, userId: string, body: string) {
  const supabase = createClient();
  return supabase.from("comments").insert({ post_id: postId, user_id: userId, body });
}

export async function deletePost(postId: string, userId: string) {
  const supabase = createClient();
  return supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);
}

/** ログイン中ユーザーのプロフィールを保証して返す（無ければ作る） */
export async function ensureProfile(user: User): Promise<CotozuteProfile & { id: string; username: string }> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (existing?.username) return existing as CotozuteProfile & { id: string; username: string };
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const username = email ? email.split("@")[0] : user.id.slice(0, 8);
  const row = {
    id: user.id,
    username,
    display_name: (meta.full_name as string) ?? (meta.name as string) ?? "むらびと",
    email,
    avatar_url: (meta.avatar_url as string) ?? null,
  };
  await supabase.from("profiles").upsert(row, { onConflict: "id" });
  return { id: user.id, username, display_name: row.display_name, avatar_url: row.avatar_url };
}
