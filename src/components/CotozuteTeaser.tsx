"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchMyLikes } from "@/lib/cotozute";
import { PostCard } from "./PostCard";
import { srcCdn } from "@/lib/images";

/**
 * Cotozuteチラ見せ — 最新5件だけ見せて、本体（/cotozute の無限フィード）へ誘う。
 * ホームとMMMに置く。
 */
export function CotozuteTeaser() {
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null); // マイページで変えた写真を優先

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) {
        // まず端末キャッシュで即描画(遅い回線で 葉っぱ→Google→正式 と三段変化する事故防止)→裏で最新化
        import("@/lib/avatarCache").then(({ cachedAvatar, cacheAvatar }) => {
          const cached = cachedAvatar(u.id);
          if (cached) setMyAvatar(cached);
          supabase.from("profiles").select("avatar_url").eq("id", u.id).maybeSingle().then(({ data }) => {
            if (data?.avatar_url) setMyAvatar(data.avatar_url);
            if (data) cacheAvatar(u.id, data.avatar_url ?? null);
          });
        });
        setLikedSet(await fetchMyLikes(u.id));
      }
    });
    fetchPostsPage(0, 5).then(setPosts);
  }, []);

  return (
    <section
      className="card"
      style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)", margin: "0 -16px", borderRadius: 0, borderLeft: "none", borderRight: "none", paddingTop: 8, paddingBottom: 84 }}
    >
      <Link href="/cotozute" className="no-underline">
        <span
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-3.5 pb-[6px] pt-[7px]"
          style={{
            background: "linear-gradient(120deg,#2CB7DE,#1B8FB5)",
            boxShadow: "0 4px 14px rgba(44,183,222,.35)",
          }}
        >
          <span className="relative text-[14px] leading-none text-white">
            ✦<span className="absolute -right-1.5 -top-1 text-[8px]">✦</span>
          </span>
          {/* 文字が下詰まりに見えるため、行ボックスを締めて1px持ち上げる */}
          <span className="relative top-[-1px] text-[15px] font-extrabold leading-none text-white" style={{ letterSpacing: 0 }}>
            CotoZute<span style={{ marginLeft: "-0.08em" }}>→</span>
          </span>
        </span>
      </Link>
      {/* 入力ボックス（タップでコトヅテの投稿画面へ） */}
      <Link href="/cotozute?compose=1" className="mb-2 flex items-center gap-2.5 no-underline">
        {myAvatar || me?.user_metadata?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={srcCdn(myAvatar ?? (me!.user_metadata!.avatar_url as string))} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ead9] text-[16px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
        )}
        <span className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14px] text-[#8a8d91]">
          幸せの波紋を拡げよう<span className="caret-blink" aria-hidden />
        </span>
      </Link>
      {posts === null ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">まだ言の葉がありません <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></p>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} onDeleted={() => fetchPostsPage(0, 5).then(setPosts)} />
        ))
      )}
      <Link
        href="/cotozute"
        className="mt-2 block w-full rounded-xl py-2.5 text-center text-[13px] font-extrabold text-white no-underline shadow-sm"
        style={{ background: "linear-gradient(135deg,#2CB7DE,#1B8FB5)" }}
      >
        もっとCotozuteを見る →
      </Link>
    </section>
  );
}
