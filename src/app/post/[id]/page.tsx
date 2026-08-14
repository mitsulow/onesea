"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useWarawaGate } from "@/lib/warawaGate";
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
import { ImagePair, uploadImagePair, srcCdn } from "@/lib/images";

/* eslint-disable @next/next/no-img-element */

/** 言の葉の詳細 — 文を寄せる（コメント） */
export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;
  const [post, setPost] = useState<CotozutePost | null | undefined>(undefined);
  const [comments, setComments] = useState<CotozuteComment[]>([]);
  const gate = useWarawaGate("/lp/onesea");
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editImgs, setEditImgs] = useState<ImagePair[]>([]);
  const [upBusy, setUpBusy] = useState(false);
  const [amOffice, setAmOffice] = useState(false);

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
      if (u) {
        setLikedSet(await fetchMyLikes(u.id));
        import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(u.id).then(setAmOffice)).catch(() => {});
      }
    });
    load();
  }, [load]);

  /** 修正モードに入る（本文+写真を編集対象にする） */
  const startEdit = useCallback((p: CotozutePost) => {
    setEditDraft(p.body ?? "");
    setEditImgs((p.image_urls ?? []).map((f, i) => ({ full: f, thumb: p.thumb_urls?.[i] ?? f })));
    setEditing(true);
  }, []);

  /* フィードの⋯→編集から ?edit=1 で来たら、修正ボタンを押した後の状態で開く */
  useEffect(() => {
    if (!post || !me || editing) return;
    if (!new URLSearchParams(window.location.search).get("edit")) return;
    if (me.id === post.user_id || amOffice) startEdit(post);
  }, [post, me, amOffice, editing, startEdit]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    await ensureProfile(me);
    if (!(await gate.check("コメント"))) return;
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
        <button onClick={() => router.back()} className="text-[13px] font-bold text-[#d4b96a]">
          ◀ もどる
        </button>
        <span className="text-[11px] tracking-widest text-[#7a9ab4]">言の葉</span>
        <span className="w-12" />
      </header>

      <div className="px-4 pt-4">
        <div className="card">
          {editing ? (
            <div className="py-2">
              <div className="mb-1.5 text-[11px] font-bold text-[#8a7a5a]">
                コトヅテを修正{amOffice && me?.id !== post.user_id ? "（事務局権限）" : ""}
              </div>
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={6}
                autoFocus
                className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-[#c94d3a]"
              />
              {/* 写真の差し替え: ✕で外す・+で追加（合計4枚まで） */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {editImgs.map((im, i) => (
                  <div key={im.thumb + i} className="relative">
                    <img src={srcCdn(im.thumb)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      onClick={() => setEditImgs(editImgs.filter((_, j) => j !== i))}
                      aria-label="この写真を外す"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                    >✕</button>
                  </div>
                ))}
                {editImgs.length < 4 && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#c8bfa8] bg-white text-[11px] font-bold text-[#8a7a5a]">
                    {upBusy ? "⏳" : <>＋<span>写真</span></>}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        if (!me || !e.target.files?.length || upBusy) return;
                        setUpBusy(true);
                        const files = Array.from(e.target.files).slice(0, 4 - editImgs.length);
                        const pairs: ImagePair[] = [];
                        for (const f of files) {
                          const pair = await uploadImagePair("post-images", me.id, f);
                          if (pair) pairs.push(pair);
                        }
                        if (pairs.length) setEditImgs((prev) => [...prev, ...pairs].slice(0, 4));
                        setUpBusy(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a09888]">
                  キャンセル
                </button>
                <button
                  onClick={async () => {
                    if (!me || editSaving) return;
                    if (!editDraft.trim() && editImgs.length === 0) return;
                    setEditSaving(true);
                    const { error } = await createClient()
                      .from("posts")
                      .update({
                        body: editDraft.trim(),
                        image_urls: editImgs.map((i) => i.full),
                        thumb_urls: editImgs.map((i) => i.thumb),
                      })
                      .eq("id", post.id);
                    setEditSaving(false);
                    if (error) { alert("保存できませんでした: " + error.message); return; }
                    setEditing(false);
                    load();
                  }}
                  disabled={(!editDraft.trim() && editImgs.length === 0) || editSaving || upBusy}
                  className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                  style={{ background: "#c94d3a" }}
                >
                  {editSaving ? "保存中..." : "修正を保存"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <PostCard post={post} me={me} liked={likedSet.has(post.id)} hd />
              {me && (me.id === post.user_id || amOffice) && (
                <button
                  onClick={() => startEdit(post)}
                  className="mt-2 w-full rounded-xl border border-[#e8dcc4] bg-white py-2 text-[12.5px] font-bold text-[#8a7a5a]"
                >
                  コトヅテを修正
                </button>
              )}
            </>
          )}

          {/* コメント（修正モード中は出さない — 修正だけに集中・ユーザー指定） */}
          {!editing && (
          <div className="mt-3">
            <div className="sec mb-2"><img src="/icons/icon-chat.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> コメント</div>
            {gate.node}
            {comments.length === 0 ? (
              <p className="pb-2 text-[12.5px] text-[#b8b0a0]">まだコメントはありません</p>
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
                          <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
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
                  placeholder="コメントして応援する"
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
                    {sending ? "送信中..." : "投稿"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="pt-2 text-[11.5px] text-[#b8b0a0]">コメントするにはログインしてください</p>
            )}
          </div>
          )}
        </div>
      </div>
    </main>
  );
}
