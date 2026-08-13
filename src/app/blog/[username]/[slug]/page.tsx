"use client";

/** ブログ記事ページ。
 *  予約投稿(publish_atが未来)はRLSで本人以外に行が返らない → アメブロと同じ
 *  「ブログ記事が無いようです」を表示。時刻が来ると自動で公開される。 */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { AvatarMenu } from "@/components/AvatarMenu";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { blogOwner, blogPost, blogNeighbors, sanitizeHtml, jstDateTime, BlogPost } from "@/lib/blog";

export default function BlogEntry({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = use(params);
  const [owner, setOwner] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null } | null | undefined>(undefined);
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);
  const [nb, setNb] = useState<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }>({ prev: null, next: null });
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    blogOwner(username).then((o) => {
      setOwner(o);
      if (!o) { setPost(null); return; }
      createClient().auth.getSession().then(({ data: { session } }) => setIsMe(session?.user?.id === o.id));
      blogPost(o.id, slug).then((p) => {
        setPost(p);
        if (p) blogNeighbors(o.id, p.posted_at).then(setNb);
      });
    });
  }, [username, slug]);

  if (owner === undefined || post === undefined) return <main className="min-h-screen bg-[#f4f6f2]" />;

  // アメブロと同じ: 存在しない or まだ公開時刻前 → 記事なしメッセージ
  if (!owner || !post) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f6f2] px-6">
        <div className="text-[40px]">📭</div>
        <p className="text-[15px] font-bold text-[#6a7260]">ブログ記事が無いようです</p>
        <p className="text-center text-[11.5px] leading-relaxed text-[#a0a894]">記事が削除されたか、URLが間違っているか、<br />まだ公開されていない可能性があります。</p>
        {owner && (
          <Link href={`/blog/${owner.username}`} className="rounded-full border border-[#dde2d2] bg-white px-5 py-2 text-[12.5px] font-bold text-[#5a8a3c] no-underline">
            ブログトップへ
          </Link>
        )}
      </main>
    );
  }

  const scheduled = new Date(post.publish_at).getTime() > Date.now();

  return (
    <main className="min-h-screen bg-[#f4f6f2] pb-24">
      <header className="sticky top-0 z-40 border-b border-[#e0e4d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[52px] max-w-[760px] items-center justify-between px-3">
          <Link href={`/blog/${owner.username}`} className="flex min-w-0 items-center gap-2 no-underline">
            {owner.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={srcCdn(owner.avatar_url)} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            )}
            <span className="truncate text-[13.5px] font-extrabold text-[#3a4030]">{owner.display_name ?? owner.username}徒然日記</span>
          </Link>
          <AvatarMenu />
        </div>
      </header>

      <article className="mx-auto max-w-[760px] px-4">
        {scheduled && isMe && (
          <div className="mt-3 rounded-xl border border-[#f0d8a8] bg-[#fdf6e4] px-4 py-2.5 text-[12px] font-bold text-[#b07a2a]">
            ⏰ 予約投稿（{jstDateTime(post.publish_at)} に自動公開・いまはあなたにだけ見えています）
          </div>
        )}
        <div className="mt-4 border-b border-[#e4e8dc] pb-3">
          <p className="num text-[11.5px] text-[#a0a894]">
            {jstDateTime(post.posted_at)}
            {post.genre && (
              <Link href={`/blog/${owner.username}?genre=${encodeURIComponent(post.genre)}`} className="ml-2 rounded bg-[#eaf2e0] px-1.5 py-0.5 text-[10px] font-bold text-[#5a8a3c] no-underline">
                {post.genre}
              </Link>
            )}
          </p>
          <h1 className="mt-1.5 text-[21px] font-extrabold leading-snug text-[#2c3226]">{post.title}</h1>
        </div>

        {/* 本文（アメブロから引っ越したHTML/エディタで作ったHTML） */}
        <div className="blog-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body_html) }} />

        {post.hashtags && post.hashtags.length > 0 && (
          <p className="mt-4 text-[12px] text-[#5a8a3c]">{post.hashtags.filter(Boolean).map((h) => `#${h}`).join(" ")}</p>
        )}

        {isMe && (
          <div className="mt-5">
            <Link href={`/blog/new?edit=${post.slug}`} className="rounded-full border border-[#dde2d2] bg-white px-4 py-2 text-[12px] font-bold text-[#6a7260] no-underline">この記事を編集</Link>
          </div>
        )}

        {/* 前後の記事ナビ（アメブロ式） */}
        <nav className="mt-8 space-y-2 border-t border-[#e4e8dc] pt-4">
          {nb.next && (
            <Link href={`/blog/${owner.username}/${nb.next.slug}`} className="block rounded-xl border border-[#e4e8dc] bg-white px-4 py-3 no-underline">
              <span className="block text-[10px] font-bold text-[#a0a894]">次の記事 ≫</span>
              <span className="block truncate text-[13.5px] font-bold text-[#3a4030]">{nb.next.title}</span>
            </Link>
          )}
          {nb.prev && (
            <Link href={`/blog/${owner.username}/${nb.prev.slug}`} className="block rounded-xl border border-[#e4e8dc] bg-white px-4 py-3 no-underline">
              <span className="block text-[10px] font-bold text-[#a0a894]">≪ 前の記事</span>
              <span className="block truncate text-[13.5px] font-bold text-[#3a4030]">{nb.prev.title}</span>
            </Link>
          )}
          <Link href={`/blog/${owner.username}`} className="block py-2 text-center text-[12.5px] font-bold text-[#5a8a3c] no-underline">ブログトップ（記事一覧）へ</Link>
        </nav>
      </article>
    </main>
  );
}
