"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useRef, useState } from "react";
import { CotozutePost, toggleLike, deletePost } from "@/lib/cotozute";
import { EmbedCard } from "./EmbedCard";
import { MeishiModal } from "./MeishiModal";

/** X風の相対時刻: 今 / N分 / N時間 / N日 / M/D */
function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "今";
  if (s < 3600) return `${Math.floor(s / 60)}分`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 言の葉カード（楽市楽座「情緒」と同じ操作系）:
 * アイコンタップ → まず名刺モーダル → マイページ / 🌱 いいね / 💬 コメント / 自分の投稿は消せる
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
  const router = useRouter();
  const pr = post.profiles;
  const [isLiked, setIsLiked] = useState(liked);
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count ?? 0);
  const commentCount = post.comments?.[0]?.count ?? 0;
  const [gone, setGone] = useState(false);
  const [meishi, setMeishi] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (gone) return null;

  const onLike = async () => {
    if (!me) return;
    setIsLiked(!isLiked);
    setLikeCount((c) => c + (isLiked ? -1 : 1));
    await toggleLike(post.id, me.id, isLiked);
  };

  const startPress = () => {
    if (me?.id !== post.user_id) return;
    pressTimer.current = setTimeout(() => onDelete(), 600);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
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
      className="h-[38px] w-[38px] rounded-full object-cover"
    />
  ) : (
    <div
      className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[16px]"
      style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
    >
      🌿
    </div>
  );

  return (
    <div
      className="flex cursor-pointer gap-3 border-b border-[#f2ece0] py-3 active:bg-[#faf6ec]"
      onClick={(e) => {
        // ボタン・リンク・画像以外の空白タップは詳細へ（X同様、行全体が入口）
        if ((e.target as HTMLElement).closest("button,a,img,textarea,input")) return;
        router.push(`/post/${post.id}`);
      }}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
    >
      {meishi && pr?.username && <MeishiModal username={pr.username} onClose={() => setMeishi(false)} />}
      <div className="flex-shrink-0">
        {pr?.username ? (
          <button onClick={() => setMeishi(true)} aria-label={`${pr.display_name ?? ""}の名刺を見る`}>
            {avatar}
          </button>
        ) : (
          avatar
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* X風の1行ヘッダー: 名前 @ハンドル ・ 相対時刻 */}
        <div className="flex min-w-0 items-baseline gap-1">
          {pr?.username ? (
            <button
              onClick={() => setMeishi(true)}
              className="max-w-[45%] truncate text-left text-[15px] font-bold text-[#3a3428]"
            >
              {pr.display_name ?? "むらびと"}
            </button>
          ) : (
            <span className="text-[15px] font-bold text-[#3a3428]">むらびと</span>
          )}
          {pr?.username && (
            <span className="min-w-0 truncate text-[12.5px] text-[#b8b0a0]">@{pr.username}</span>
          )}
          <span className="flex-shrink-0 text-[12.5px] text-[#b8b0a0]">・{relTime(post.created_at)}</span>
        </div>
        {post.body?.trim() && (
          <p
            onClick={() => router.push(`/post/${post.id}`)}
            className="cursor-pointer break-words text-[15px] leading-relaxed text-[#3a3428]"
          >
            {post.body}
          </p>
        )}
        {post.image_urls && post.image_urls.length > 0 && (
          <div className={`mt-1.5 grid gap-1 ${post.image_urls.length > 1 ? "grid-cols-2" : ""}`}>
            {post.image_urls.map((full, i) => (
              <a key={i} href={full} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.thumb_urls?.[i] ?? full}
                  alt=""
                  loading="lazy"
                  className="w-full rounded-xl object-cover"
                  style={post.image_urls!.length > 1 ? { aspectRatio: "1" } : { maxHeight: 360 }}
                />
              </a>
            ))}
          </div>
        )}
        {post.embed && <EmbedCard embed={post.embed} />}
        {/* X風アクションバー: 均等に散らす（返信・いいね・シェア） */}
        <div className="mt-1.5 flex max-w-[260px] items-center justify-between">
          <Link
            href={`/post/${post.id}`}
            className="flex items-center gap-1 py-1.5 pr-4 text-[13px] text-[#b0a898] no-underline"
            aria-label="コメント"
          >
            💬 <span className="num">{commentCount > 0 ? commentCount : ""}</span>
          </Link>
          <button
            onClick={onLike}
            disabled={!me}
            className={`flex items-center gap-1 px-4 py-1.5 text-[13px] transition-transform active:scale-125 ${isLiked ? "font-bold text-[#e05070]" : "text-[#b0a898]"}`}
            aria-label="いいね"
          >
            {isLiked ? "❤️" : "🤍"} <span className="num">{likeCount > 0 ? likeCount : ""}</span>
          </button>
          <button
            onClick={() => {
              const url = `https://onesea.vercel.app/post/${post.id}`;
              if (navigator.share) navigator.share({ text: post.body ?? "", url }).catch(() => {});
              else navigator.clipboard?.writeText(url);
            }}
            className="px-4 py-1.5 text-[13px] text-[#b0a898]"
            aria-label="シェア"
          >
            ↗
          </button>
          {me?.id === post.user_id && (
            <button onClick={onDelete} className="py-1.5 pl-4 text-[11px] text-[#c8beac]" aria-label="削除">
              消す
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
