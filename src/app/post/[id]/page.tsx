"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  CotozutePost,
  CotozuteComment,
  fetchPost,
  fetchComments,
  fetchMyLikes,
  addComment,
  ensureProfile,
} from "@/lib/cotozute";
import { PostCard } from "@/components/PostCard";

/** 言の葉の詳細 — 文を寄せる（コメント） */
export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const [post, setPost] = useState<CotozutePost | null | undefined>(undefined);
  const [comments, setComments] = useState<CotozuteComment[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
    setPost(p);
    setComments(c);
  }, [postId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
    load();
  }, [load]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    await ensureProfile(me);
    await addComment(postId, me.id, body.trim());
    setBody("");
    setSending(false);
    load();
  };

  if (post === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-[#8a8070]">この言の葉は見つかりませんでした</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#c94d3a] underline">
          マイページへもどる
        </Link>
      </div>
    );
  }

  return (
    <main className="pb-10">
      <header
        className="flex items-center justify-between px-5 pb-3.5 pt-4"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/" className="text-[13px] font-bold text-[#d4b96a] no-underline">
          ◀ もどる
        </Link>
        <span className="text-[11px] tracking-widest text-[#7a9ab4]">言の葉</span>
        <span className="w-12" />
      </header>

      <div className="px-4 pt-4">
        <div className="card">
          <PostCard post={post} me={me} liked={likedSet.has(post.id)} />

          {/* 文を寄せる */}
          <div className="mt-3">
            <div className="sec mb-2">✉ 文を寄せる</div>
            {comments.length === 0 ? (
              <p className="pb-2 text-[12.5px] text-[#b8b0a0]">まだ文はありません</p>
            ) : (
              comments.map((c) => {
                const d = new Date(c.created_at);
                return (
                  <div key={c.id} className="flex gap-2.5 border-b border-[#f2ece0] py-2">
                    <div className="flex-shrink-0">
                      {c.profiles?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.profiles.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[12px]"
                          style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                        >
                          🌿
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        {c.profiles?.username ? (
                          <Link
                            href={`/u/${c.profiles.username}`}
                            className="text-[12px] font-bold text-[#4a4438] no-underline"
                          >
                            {c.profiles.display_name ?? "むらびと"}
                          </Link>
                        ) : (
                          <span className="text-[12px] font-bold text-[#4a4438]">むらびと</span>
                        )}
                        <span className="num text-[10px] text-[#c0b8a8]">
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                      </div>
                      <p className="break-words text-[13px] leading-relaxed text-[#5a5448]">{c.body}</p>
                    </div>
                  </div>
                );
              })
            )}

            {me ? (
              <div className="mt-2.5">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="そっと、ひとこと..."
                  rows={2}
                  className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    onClick={submit}
                    disabled={!body.trim() || sending}
                    className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
                    style={{ background: "#c94d3a" }}
                  >
                    {sending ? "送信中..." : "文を寄せる"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="pt-2 text-[11.5px] text-[#b8b0a0]">文を寄せるにはログインしてください</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
