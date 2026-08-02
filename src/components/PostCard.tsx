"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CotozutePost, toggleLike, deletePost, warawer } from "@/lib/cotozute";
import { EmbedCard } from "./EmbedCard";
import { MeishiModal } from "./MeishiModal";

/* eslint-disable @next/next/no-img-element */

/**
 * 言の葉カード — Facebook型。
 * ヘッダー（丸アイコン・太字名・時間）→ 本文1行+もっと見る → 写真は左右いっぱい
 * → ❤コメント シェア → いいねした人の顔。アイコンタップで名刺。
 */

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function PostCard({
  post,
  me,
  liked,
  onDeleted,
  hd = false,
  flush = false,
  likers,
}: {
  post: CotozutePost;
  me: User | null;
  liked: boolean;
  onDeleted?: () => void;
  /** 詳細ページ: 本体画質+本文全文表示 */
  hd?: boolean;
  flush?: boolean;
  /** いいねした人の顔（最大3つ・FB風） */
  likers?: Array<{ avatar_url: string | null; display_name: string | null }>;
}) {
  void flush;
  const router = useRouter();
  const pr = post.profiles;
  const bodyText = post.embed?.url
    ? (post.body ?? "").split(post.embed.url).join("").trim()
    : post.body;
  const [isLiked, setIsLiked] = useState(liked);
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count ?? 0);
  const commentCount = post.comments?.[0]?.count ?? 0;
  const [gone, setGone] = useState(false);
  const [meishi, setMeishi] = useState(false);
  const [expanded, setExpanded] = useState(hd);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (gone) return null;

  const needsFold = !hd && !!bodyText && (bodyText.length > 42 || bodyText.includes("\n"));

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
    <img
      src={pr.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      className="h-[40px] w-[40px] rounded-full object-cover"
    />
  ) : (
    <div
      className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-[16px]"
      style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
    >
      🌿
    </div>
  );

  return (
    <div
      className="py-2.5"
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
    >
      {meishi && pr?.username && <MeishiModal username={pr.username} onClose={() => setMeishi(false)} />}

      {/* ヘッダー */}
      <div className="flex items-center gap-2.5">
        {pr?.username ? (
          <button onClick={() => setMeishi(true)} className="flex-shrink-0" aria-label="名刺を見る">
            {avatar}
          </button>
        ) : (
          <div className="flex-shrink-0">{avatar}</div>
        )}
        <div className="min-w-0 flex-1">
          {pr?.username ? (
            <button
              onClick={() => setMeishi(true)}
              className="block max-w-full truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21]"
            >
              {pr.display_name ?? "むらびと"}
            </button>
          ) : (
            <span className="text-[14.5px] font-bold text-[#1c1e21]">むらびと</span>
          )}
          <div className="text-[11.5px] leading-tight text-[#8a8d91]">
            {relTime(post.created_at)}
            {warawer(pr?.member_no) && <span className="ml-1.5">{warawer(pr?.member_no)}</span>}
          </div>
        </div>
        {me?.id === post.user_id && (
          <button onClick={onDelete} className="flex-shrink-0 px-1 text-[12px] text-[#b0b3b8]" aria-label="削除">
            ×
          </button>
        )}
      </div>

      {/* 本文（1行 → もっと見る） */}
      {bodyText?.trim() && (
        <div className="mt-2">
          <p
            className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1c1e21] ${
              expanded ? "" : "line-clamp-1"
            }`}
            onClick={() => (needsFold && !expanded ? setExpanded(true) : router.push(`/post/${post.id}`))}
          >
            {bodyText}
          </p>
          {needsFold && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-[13.5px] text-[#8a8d91]">
              …もっと見る
            </button>
          )}
        </div>
      )}

      {/* 写真（左右いっぱい） */}
      {post.image_urls && post.image_urls.length > 0 && (
        <div className={`-mx-4 mt-2 grid gap-0.5 ${post.image_urls.length > 1 ? "grid-cols-2" : ""}`}>
          {post.image_urls.map((full, i) => (
            <a key={i} href={full} target="_blank" rel="noopener noreferrer">
              <img
                src={hd ? full : post.thumb_urls?.[i] ?? full}
                alt=""
                loading="lazy"
                className="w-full object-cover"
                style={post.image_urls!.length > 1 ? { aspectRatio: "1" } : { maxHeight: 480 }}
              />
            </a>
          ))}
        </div>
      )}
      {post.embed && <EmbedCard embed={post.embed} />}

      {/* アクション（❤ 数字 / 💬 数字 / シェア） */}
      <div className="mt-2 flex items-center border-t border-[#f0f2f5] pt-1.5">
        <button
          onClick={onLike}
          disabled={!me}
          className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] transition-transform active:scale-110 ${
            isLiked ? "font-bold text-[#e0455a]" : "text-[#65676b]"
          }`}
        >
          {isLiked ? "❤️" : "🤍"} <span className="num">{likeCount > 0 ? likeCount : "いいね"}</span>
        </button>
        <Link
          href={`/post/${post.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] text-[#65676b] no-underline"
        >
          💬 <span className="num">{commentCount > 0 ? commentCount : "コメント"}</span>
        </Link>
        <button
          onClick={() => {
            const url = `https://onesea.vercel.app/post/${post.id}`;
            if (navigator.share) navigator.share({ text: bodyText ?? "", url }).catch(() => {});
            else navigator.clipboard?.writeText(url);
          }}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] text-[#65676b]"
        >
          ↗ シェア
        </button>
      </div>

      {/* いいねした人の顔（FB風） */}
      {likers && likers.length > 0 && (
        <div className="mt-1 flex items-center">
          {likers.map((l, i) => (
            <span key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
              {l.avatar_url ? (
                <img
                  src={l.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-[20px] w-[20px] rounded-full border-2 border-white object-cover"
                />
              ) : (
                <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#cfe8d8] text-[10px]">
                  🌿
                </span>
              )}
            </span>
          ))}
          <span className="ml-1.5 text-[11px] text-[#8a8d91]">
            {likers[0]?.display_name ?? ""}
            {likeCount > 1 ? ` 他${likeCount - 1}人` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
