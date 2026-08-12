"use client";

/** マイページの「今日の日記」コーナー。最新のブログ記事を1件見せて /blog へ誘う。
 *  記事が無い他人のページでは何も出さない（本人には「書く/引っ越し」導線を出す） */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { jstDate } from "@/lib/blog";

export function BlogCorner({ userId, username, isMe }: { userId: string; username: string | null; isMe: boolean }) {
  const [latest, setLatest] = useState<{ slug: string; title: string; posted_at: string; thumb_url: string | null; genre: string | null } | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("blog_posts")
      .select("slug, title, posted_at, thumb_url, genre")
      .eq("user_id", userId)
      .lte("publish_at", new Date().toISOString())
      .order("posted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatest(data ?? null));
  }, [userId]);

  if (latest === undefined) return null;
  if (latest === null && !isMe) return null;
  if (!username) return null;

  return (
    <div className="mt-2.5 px-4 py-3.5" style={{ background: "linear-gradient(135deg,#eef4e6,#f6f8f0)", border: "1px solid #d4dec2" }}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-[2px] text-[#5a7a3c]">📖 今日の日記</div>
        {isMe && (
          <span className="flex gap-2">
            <Link href="/blog/new" className="text-[11px] font-extrabold text-[#5a8a3c] underline">書く</Link>
            <Link href="/blog/import" className="text-[11px] font-bold text-[#8a9a78] underline">引っ越し</Link>
          </span>
        )}
      </div>
      {latest ? (
        <Link href={`/blog/${username}/${latest.slug}`} className="mt-2 flex items-center gap-3 no-underline">
          {latest.thumb_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={srcCdn(latest.thumb_url)} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
          )}
          <span className="min-w-0">
            <span className="num block text-[10.5px] text-[#8a9a78]">
              {jstDate(latest.posted_at)}
              {latest.genre && <span className="ml-1.5">・{latest.genre}</span>}
            </span>
            <span className="block truncate text-[14px] font-bold text-[#3a4030]">{latest.title}</span>
          </span>
        </Link>
      ) : (
        <p className="mt-1.5 text-[12px] text-[#8a9a78]">まだ日記がありません。「書く」か「引っ越し」から始めましょう。</p>
      )}
      <Link href={`/blog/${username}`} className="mt-2.5 block rounded-xl border border-[#c8d6b0] bg-white py-2 text-center text-[12px] font-extrabold text-[#5a8a3c] no-underline">
        ブログを読む（記事一覧）
      </Link>
    </div>
  );
}
