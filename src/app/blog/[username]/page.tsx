"use client";

/** ブログトップ（月別・ジャンル別アーカイブ + 記事一覧）。アメブロの記事一覧の操作感を踏襲 */

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AvatarMenu } from "@/components/AvatarMenu";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { blogOwner, blogArchive, blogList, jstDate, BLOG_PAGE_SIZE, BlogListItem } from "@/lib/blog";

export default function BlogTop({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const sp = useSearchParams();
  const month = sp.get("month") ?? undefined;
  const genre = sp.get("genre") ?? undefined;
  const page = parseInt(sp.get("page") ?? "0", 10) || 0;

  const [owner, setOwner] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null } | null | undefined>(undefined);
  const [arch, setArch] = useState<{ months: Array<[string, number]>; genres: Array<[string, number]>; total: number } | null>(null);
  const [list, setList] = useState<BlogListItem[] | null>(null);
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    blogOwner(username).then((o) => {
      setOwner(o);
      if (o) {
        blogArchive(o.id).then(setArch);
        createClient().auth.getSession().then(({ data: { session } }) => setIsMe(session?.user?.id === o.id));
      }
    });
  }, [username]);

  useEffect(() => {
    if (!owner) return;
    setList(null);
    blogList(owner.id, { month, genre, page }).then(setList);
  }, [owner, month, genre, page]);

  const filterQS = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { month, genre, page: undefined as string | undefined, ...over };
    if (merged.month) q.set("month", merged.month);
    if (merged.genre) q.set("genre", merged.genre);
    if (merged.page) q.set("page", merged.page);
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const monthLabel = useMemo(() => (month ? `${month.split("-")[0]}年${Number(month.split("-")[1])}月` : null), [month]);

  if (owner === undefined) return <main className="min-h-screen bg-[#f4f6f2]" />;
  if (owner === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f2] text-[14px] text-[#8a8d80]">ブログが見つかりません</main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f2] pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 border-b border-[#e0e4d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[52px] max-w-[760px] items-center justify-between px-3">
          <Link href={`/blog/${owner.username}`} className="flex min-w-0 items-center gap-2 no-underline">
            {owner.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={srcCdn(owner.avatar_url)} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-extrabold text-[#3a4030]">{owner.display_name ?? owner.username}のブログ</span>
              <span className="block text-[9.5px] tracking-[1.5px] text-[#a0a894]">DIARY {arch ? `・全${arch.total}記事` : ""}</span>
            </span>
          </Link>
          <span className="flex items-center gap-2">
            {isMe && (
              <Link href="/blog/new" className="rounded-full px-3 py-1.5 text-[12px] font-extrabold text-white no-underline" style={{ background: "#5a8a3c" }}>
                ＋書く
              </Link>
            )}
            <AvatarMenu />
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-3">
        {/* フィルタ行: ジャンル */}
        {arch && arch.genres.length > 0 && (
          <div className="hide-scrollbar -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
            <button
              onClick={() => router.push(`/blog/${owner.username}${filterQS({ genre: undefined })}`)}
              className="flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
              style={!genre ? { background: "#5a8a3c", borderColor: "#5a8a3c", color: "#fff" } : { background: "#fff", borderColor: "#dde2d2", color: "#6a7260" }}
            >
              すべて
            </button>
            {arch.genres.map(([g, c]) => (
              <button
                key={g}
                onClick={() => router.push(`/blog/${owner.username}${filterQS({ genre: g })}`)}
                className="flex-shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
                style={genre === g ? { background: "#5a8a3c", borderColor: "#5a8a3c", color: "#fff" } : { background: "#fff", borderColor: "#dde2d2", color: "#6a7260" }}
              >
                {g}（{c}）
              </button>
            ))}
          </div>
        )}

        {/* フィルタ行: 月別 */}
        {arch && arch.months.length > 0 && (
          <div className="hide-scrollbar -mx-3 mt-1 flex gap-1.5 overflow-x-auto px-3 pb-1">
            <button
              onClick={() => router.push(`/blog/${owner.username}${filterQS({ month: undefined })}`)}
              className="num flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={{ color: !month ? "#5a8a3c" : "#9aa28e", background: !month ? "#eaf2e0" : "transparent" }}
            >
              全期間
            </button>
            {arch.months.map(([m, c]) => (
              <button
                key={m}
                onClick={() => router.push(`/blog/${owner.username}${filterQS({ month: m })}`)}
                className="num flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                style={{ color: month === m ? "#5a8a3c" : "#9aa28e", background: month === m ? "#eaf2e0" : "transparent" }}
              >
                {m.replace("-", "/")}（{c}）
              </button>
            ))}
          </div>
        )}

        {(monthLabel || genre) && (
          <p className="mt-2 text-[12px] font-bold text-[#6a7260]">
            {monthLabel}{monthLabel && genre ? "・" : ""}{genre} の記事
          </p>
        )}

        {/* 記事一覧 */}
        <div className="mt-2 space-y-2">
          {list === null ? (
            <p className="py-8 text-center text-[13px] text-[#9aa28e]">読み込み中...</p>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#9aa28e]">記事がありません</p>
          ) : (
            list.map((p) => {
              const scheduled = new Date(p.publish_at).getTime() > Date.now();
              return (
                <Link
                  key={p.slug}
                  href={`/blog/${owner.username}/${p.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-[#e4e8dc] bg-white p-3 no-underline"
                >
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[10.5px] text-[#a0a894]">
                      {jstDate(p.posted_at)}
                      {p.genre && <span className="ml-2 rounded bg-[#eaf2e0] px-1.5 py-0.5 text-[9.5px] font-bold text-[#5a8a3c]">{p.genre}</span>}
                      {scheduled && <span className="ml-2 rounded bg-[#fdf0dc] px-1.5 py-0.5 text-[9.5px] font-bold text-[#b07a2a]">⏰予約</span>}
                    </span>
                    <span className="mt-0.5 block text-[14.5px] font-bold leading-snug text-[#3a4030]">{p.title}</span>
                  </span>
                  {p.thumb_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={srcCdn(p.thumb_url)} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
                  )}
                </Link>
              );
            })
          )}
        </div>

        {/* ページ送り */}
        {list && (page > 0 || list.length === BLOG_PAGE_SIZE) && (
          <div className="mt-4 flex items-center justify-between">
            {page > 0 ? (
              <button onClick={() => router.push(`/blog/${owner.username}${filterQS({ page: String(page - 1) })}`)} className="rounded-full border border-[#dde2d2] bg-white px-4 py-2 text-[12.5px] font-bold text-[#5a8a3c]">← 新しい記事</button>
            ) : <span />}
            {list.length === BLOG_PAGE_SIZE ? (
              <button onClick={() => router.push(`/blog/${owner.username}${filterQS({ page: String(page + 1) })}`)} className="rounded-full border border-[#dde2d2] bg-white px-4 py-2 text-[12.5px] font-bold text-[#5a8a3c]">古い記事 →</button>
            ) : <span />}
          </div>
        )}
      </div>
    </main>
  );
}
