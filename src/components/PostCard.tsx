"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { CotozutePost, toggleLike, deletePost } from "@/lib/cotozute";

/**
 * 言の葉カード（楽市楽座「情緒」と同じ操作系）:
 * アイコンタップ → その人のマイページ / 🌱 いいね / 💬 コメント / 自分の投稿は消せる
 */
export function PostCard({
  post,
  me,
  liked,
  onDeleted,
}: {
  post: CotozutePost;
  me: User | null;
  liked: boolean;
  onDeleted?: () => void;
}) {
  const pr = post.profiles;
  const d = new Date(post.created_at);
  const [isLiked, setIsLiked] = useState(liked);
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count ?? 0);
  const commentCount = post.comments?.[0]?.count ?? 0;
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const onLike = async () => {
    if (!me) return;
    setIsLiked(!isLiked);
    setLikeCount((c) => c + (isLiked ? -1 : 1));
    await toggleLike(post.id, me.id, isLiked);
  };

  const onDelete = async () => {
    if (!me || me.id !== post.user_id) return;
    if (!confirm("この言の葉を消しますか？")) return;
    setGone(true);
    await deletePost(post.id, me.id);
    onDeleted?.();
  };

  const avatar = pr?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={pr.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      className="h-[34px] w-[34px] rounded-full object-cover"
    />
  ) : (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px]"
      style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
    >
      🌿
    </div>
  );

  return (
    <div className="flex gap-2.5 border-b border-[#f2ece0] py-2.5">
      <div className="flex-shrink-0">
        {pr?.username ? (
          <Link href={`/u/${pr.username}`} aria-label={`${pr.display_name ?? ""}のマイページ`}>
            {avatar}
          </Link>
        ) : (
          avatar
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2">
          {pr?.username ? (
            <Link href={`/u/${pr.username}`} className="text-[13px] font-bold text-[#4a4438] no-underline">
              {pr.display_name ?? "むらびと"}
            </Link>
          ) : (
            <span className="text-[13px] font-bold text-[#4a4438]">むらびと</span>
          )}
          <span className="num text-[10.5px] text-[#c0b8a8]">
            {d.getMonth() + 1}/{d.getDate()}
          </span>
        </div>
        {post.body?.trim() && (
          <p className="break-words text-[13.5px] leading-relaxed text-[#5a5448]">{post.body}</p>
        )}
        {post.image_urls?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_urls[0]} alt="" loading="lazy" className="mt-1.5 max-w-full rounded-lg" />
        )}
        <div className="mt-1.5 flex items-center gap-5">
          <button
            onClick={onLike}
            disabled={!me}
            className={`flex items-center gap-1 text-[12px] ${isLiked ? "font-bold text-[#4a8a5c]" : "text-[#b0a898]"}`}
            aria-label="いいね"
          >
            🌱 {likeCount > 0 ? likeCount : ""}
          </button>
          <Link
            href={`/post/${post.id}`}
            className="flex items-center gap-1 text-[12px] text-[#b0a898] no-underline"
            aria-label="文を寄せる"
          >
            💬 {commentCount > 0 ? commentCount : ""}
          </Link>
          {me?.id === post.user_id && (
            <button onClick={onDelete} className="ml-auto text-[11px] text-[#c8beac]" aria-label="削除">
              消す
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
