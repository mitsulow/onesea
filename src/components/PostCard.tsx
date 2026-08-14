"use client";

import { ReportDialog } from "@/components/ReportDialog";
import { fetchFollowees, toggleFollow } from "@/lib/follows";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CotozutePost, CotozuteComment, toggleLike, deletePost } from "@/lib/cotozute";
import { EmbedCard } from "./EmbedCard";
import { MeishiModal } from "./MeishiModal";
import { srcCdn } from "@/lib/images";
import { useWarawaGate } from "@/lib/warawaGate";
import { isWarawaUntil, warawaHandle, SIR_USER_ID } from "@/lib/warawa";
import { WarawaBadge } from "@/components/WarawaBadge";

/* eslint-disable @next/next/no-img-element */

/**
 * 言の葉カード — Threads型のシンプル路線（2026-08-14ユーザー指定）。
 * ヘッダー（丸アイコン・太字名・時間・右上⋯メニュー）→ 本文 → 写真
 * → 左寄せのアイコン行（白抜きハート→押すと赤 / 吹き出し / 紙飛行機）→ いいねした人の顔。
 * 編集・削除は右上⋯に集約（旧: 編集ピル+×ボタン+長押し削除は全廃）。
 */

/** ハート: 白抜き→いいねで赤塗り（スレッズ風・形は少しふっくらさせた別物） */
function IcoHeart({ on }: { on: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? "#e8384f" : "none"} stroke={on ? "#e8384f" : "#1c1e21"} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "fill .12s, stroke .12s" }}>
      <path d="M12 20.4C7 17.2 3.4 13.9 3.4 9.8c0-2.7 2.1-4.7 4.6-4.7 1.7 0 3.3 1 4 2.5.7-1.5 2.3-2.5 4-2.5 2.5 0 4.6 2 4.6 4.7 0 4.1-3.6 7.4-8.6 10.6z" />
    </svg>
  );
}

/** コメント: 角丸の吹き出し（尻尾つき） */
function IcoBubble() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.4c4.8 0 8.3 2.9 8.3 6.8s-3.5 6.8-8.3 6.8c-.9 0-1.7-.1-2.5-.3l-3.9 1.8 1-3.4c-1.8-1.2-2.9-3-2.9-4.9 0-3.9 3.5-6.8 8.3-6.8z" />
    </svg>
  );
}

/** シェア: 紙飛行機 */
function IcoPlane() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1c1e21" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.7 3.3 4.1 10c-.9.4-.8 1.6.1 1.9l6 2 2 5.9c.3.9 1.6 1 1.9.1l6.7-16.6z" />
      <path d="M20.7 3.3 10.2 13.9" />
    </svg>
  );
}

/** 右上の⋯（3つの点） */
function IcoDots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5a5d61">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** 1,000以上は「1K」「1.5K」「12K」、100万以上は「1M」表記（Threads/Instagram式） */
function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) {
    const k = n / 1000;
    const s = k < 10 ? (Math.floor(k * 10) / 10).toFixed(1).replace(/\.0$/, "") : String(Math.floor(k));
    return `${s}K`;
  }
  const m = n / 1000000;
  const s = m < 10 ? (Math.floor(m * 10) / 10).toFixed(1).replace(/\.0$/, "") : String(Math.floor(m));
  return `${s}M`;
}

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
  const [isLiked, setIsLiked] = useState(liked);
  const [pEditOpen, setPEditOpen] = useState(false);
  const [pEditBody, setPEditBody] = useState("");
  const [pBodyNow, setPBodyNow] = useState<string | null>(null);
  const rawBody = pBodyNow ?? post.body;
  const bodyText = post.embed?.url
    ? (rawBody ?? "").split(post.embed.url).join("").trim()
    : rawBody;
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count ?? 0);
  const [cCount, setCCount] = useState(post.comments?.[0]?.count ?? 0);
  // フィード内コメント（本編を開かずその場で読める・書ける）
  const [cOpen, setCOpen] = useState(false);
  const [cList, setCList] = useState<CotozuteComment[] | null>(null);
  const [cBody, setCBody] = useState("");
  const [cSending, setCSending] = useState(false);
  const [gone, setGone] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [meishi, setMeishi] = useState(false);
  const [expanded, setExpanded] = useState(hd);
  const [menuOpen, setMenuOpen] = useState(false);
  if (gone) return null;

  const needsFold = !hd && !!bodyText && (bodyText.length > 42 || bodyText.includes("\n"));

  const gate = useWarawaGate("/lp/onesea");
  const onLike = async () => {
    if (!me) { await gate.check("いいね"); return; }
    if (!(await gate.check("いいね"))) return;
    setIsLiked(!isLiked);
    setLikeCount((c) => c + (isLiked ? -1 : 1));
    await toggleLike(post.id, me.id, isLiked);
  };

  const [amOffice, setAmOffice] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null); // フォロー状態(自分の投稿はnullのまま)
  useEffect(() => {
    if (!me || me.id === post.user_id) return;
    fetchFollowees(me.id).then((s2) => setFollowing(s2.has(post.user_id))).catch(() => {});
  }, [me, post.user_id]);
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmOffice)).catch(() => {});
  }, [me]);

  const loadComments = async () => {
    const { fetchComments } = await import("@/lib/cotozute");
    setCList(await fetchComments(post.id));
  };
  const onCommentToggle = () => {
    if (hd) {
      // 詳細ページには下に常設のコメント欄がある → そこへスクロール
      document.querySelector<HTMLTextAreaElement>("main textarea")?.focus();
      return;
    }
    const v = !cOpen;
    setCOpen(v);
    if (v && cList === null) loadComments();
  };
  const submitComment = async () => {
    if (!me || !cBody.trim() || cSending) return;
    if (!(await gate.check("コメント"))) return;
    setCSending(true);
    const { addComment, ensureProfile } = await import("@/lib/cotozute");
    await ensureProfile(me);
    await addComment(post.id, me.id, cBody.trim());
    setCBody("");
    setCSending(false);
    setCCount((c) => c + 1);
    loadComments();
  };

  const onDelete = async () => {
    if (!me || (me.id !== post.user_id && !amOffice)) return;
    if (!confirm(me.id === post.user_id ? "この言の葉を消しますか？" : "【事務局権限】この投稿を削除しますか？")) return;
    setGone(true);
    if (me.id === post.user_id) {
      await deletePost(post.id, me.id);
    } else {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().from("posts").delete().eq("id", post.id);
    }
    onDeleted?.();
  };

  const avatar = pr?.avatar_url ? (
    <img
      src={srcCdn(pr.avatar_url)}
      alt=""
      referrerPolicy="no-referrer"
      className="h-[40px] w-[40px] rounded-full object-cover"
    />
  ) : (
    <div
      className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-[16px]"
      style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
    >
      <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
    </div>
  );

  return (
    <div className="py-2.5">
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
              className="flex max-w-full items-center gap-1 truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21]"
            >
              {pr.display_name ?? "むらびと"}
              {isWarawaUntil(pr?.warawa_until) && <WarawaBadge size={14} sir={post.user_id === SIR_USER_ID} />}
            </button>
          ) : (
            <span className="text-[14.5px] font-bold text-[#1c1e21]">むらびと</span>
          )}
          <div className="text-[11.5px] leading-tight text-[#8a8d91]">
            {relTime(post.created_at)}
            {isWarawaUntil(pr?.warawa_until) && warawaHandle(post.user_id, pr?.member_no) && (
              <span className="ml-1.5">{warawaHandle(post.user_id, pr?.member_no)}</span>
            )}
          </div>
        </div>
        {me && (
          <span className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full active:bg-[#f0f2f5]"
              aria-label="投稿メニュー"
            >
              <IcoDots />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-[71] w-[176px] overflow-hidden rounded-2xl border border-[#e8eaed] bg-white py-1 shadow-xl">
                  {/* 編集/削除は投稿者と事務局だけ押せる。他の人には薄いグレーで表示（ユーザー指定） */}
                  {(() => {
                    const can = me.id === post.user_id || amOffice;
                    return (
                      <>
                        <button
                          onClick={() => { if (!can) return; setMenuOpen(false); setPEditBody(rawBody ?? ""); setPEditOpen(true); }}
                          disabled={!can}
                          className={`block w-full px-4 py-2.5 text-left text-[13.5px] font-bold ${can ? "text-[#1c1e21] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
                        >編集</button>
                        <div className="mx-3 h-px bg-[#f0f2f5]" />
                        <button
                          onClick={() => { if (!can) return; setMenuOpen(false); onDelete(); }}
                          disabled={!can}
                          className={`block w-full px-4 py-2.5 text-left text-[13.5px] font-bold ${can ? "text-[#e0455a] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
                        >削除</button>
                        <div className="mx-3 h-px bg-[#f0f2f5]" />
                        <button
                          onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                          className="block w-full px-4 py-2.5 text-left text-[13.5px] font-bold text-[#65676b] active:bg-[#f0f2f5]"
                        >通報</button>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </span>
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
                src={srcCdn(hd ? full : post.thumb_urls?.[i] ?? full)}
                alt=""
                loading="lazy"
                className="w-full object-cover"
                style={post.image_urls!.length > 1 ? { aspectRatio: "1" } : { maxHeight: 480 }}
              />
            </a>
          ))}
        </div>
      )}
      {post.embed && (
        <div className="-mx-4">
          <EmbedCard embed={post.embed} />
        </div>
      )}

      {/* アクション行 — Threads風: 左寄せ・アイコンのみ・数字は右隣に小さく（区切り線なし） */}
      <div className="mt-1.5 flex items-center">
        <button
          onClick={onLike}
          disabled={!me}
          className="flex items-center gap-1.5 rounded-full py-1.5 pl-0 pr-4 transition-transform active:scale-90"
          aria-label="いいね"
        >
          <IcoHeart on={isLiked} />
          {likeCount > 0 && (
            <span className="num text-[13px]" style={{ color: isLiked ? "#e8384f" : "#65676b" }}>{fmtCount(likeCount)}</span>
          )}
        </button>
        <button
          onClick={onCommentToggle}
          className="flex items-center gap-1.5 rounded-full py-1.5 pl-1 pr-4 transition-transform active:scale-90"
          aria-label="コメント"
        >
          <IcoBubble />
          {cCount > 0 && <span className="num text-[13px] text-[#65676b]">{fmtCount(cCount)}</span>}
        </button>
        <button
          onClick={async () => {
            const url = `https://onesea.vercel.app/post/${post.id}`;
            if (navigator.share) navigator.share({ text: bodyText ?? "", url }).catch(() => {});
            else navigator.clipboard?.writeText(url);
            // シェアされたことを投稿主にお知らせ（🔔）
            if (me && me.id !== post.user_id) {
              try {
                const { createClient } = await import("@/lib/supabase/client");
                await createClient().from("post_shares").insert({ post_id: post.id, user_id: me.id });
              } catch {}
            }
          }}
          className="flex items-center rounded-full py-1.5 pl-1 pr-4 transition-transform active:scale-90"
          aria-label="シェア"
        >
          <IcoPlane />
        </button>
        {me && me.id !== post.user_id && following !== null && (
          <button
            onClick={async () => {
              if (!(await gate.check("フォロー"))) return;
              await toggleFollow(me.id, post.user_id, following);
              setFollowing(!following);
            }}
            className="ml-auto py-1.5 pl-2 text-[12px] font-bold"
            style={{ color: following ? "#0abab5" : "#8a8d91" }}
          >
            {following ? "✓ フォロー中" : "＋ フォロー"}
          </button>
        )}
        {pEditOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-5" onClick={() => setPEditOpen(false)}>
            <div className="w-full max-w-[400px] rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 text-[13.5px] font-extrabold text-[#2a6a4a]">言の葉を編集{amOffice && me?.id !== post.user_id ? "（事務局権限）" : ""}</div>
              <textarea value={pEditBody} onChange={(e) => setPEditBody(e.target.value)} rows={5} className="w-full resize-y rounded-xl border border-[#e0e6e0] bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none" />
              <div className="mt-2 flex gap-2">
                <button onClick={() => setPEditOpen(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#8a8d91]">キャンセル</button>
                <button
                  onClick={async () => {
                    if (!pEditBody.trim()) return;
                    const { createClient } = await import("@/lib/supabase/client");
                    const { error } = await createClient().from("posts").update({ body: pEditBody.trim() }).eq("id", post.id);
                    if (error) { alert("保存できませんでした: " + error.message); return; }
                    setPBodyNow(pEditBody.trim());
                    setPEditOpen(false);
                  }}
                  disabled={!pEditBody.trim()}
                  className="flex-1 rounded-xl py-2 text-[13px] font-extrabold text-white disabled:opacity-40" style={{ background: "#2a8a4a" }}
                >保存する</button>
              </div>
            </div>
          </div>
        )}
        {gate.node}
        {reportOpen && (
          <ReportDialog kind="cotozute" targetId={post.id} targetUrl={`/post/${post.id}`} excerpt={post.body ?? ""} meId={me?.id ?? null} onClose={() => setReportOpen(false)} />
        )}
      </div>

      {/* いいねした人の顔（FB風） */}
      {likers && likers.length > 0 && (
        <div className="mt-1 flex items-center">
          {likers.map((l, i) => (
            <span key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
              {l.avatar_url ? (
                <img
                  src={srcCdn(l.avatar_url)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-[20px] w-[20px] rounded-full border-2 border-white object-cover"
                />
              ) : (
                <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#cfe8d8] text-[10px]">
                  <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
                </span>
              )}
            </span>
          ))}
          <span className="ml-1.5 text-[11px] text-[#8a8d91]">
            {likers[0]?.display_name ?? ""}
            {likeCount > 1 ? ` 他${fmtCount(likeCount - 1)}人` : ""}
          </span>
        </div>
      )}

      {/* フィード内コメント欄（本編を開かず、その場で読み書き） */}
      {cOpen && !hd && (
        <div className="mt-2 rounded-2xl bg-[#f5f6f8] px-3 pb-2.5 pt-2">
          {cList === null ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c8ccd1] border-t-transparent" />
            </div>
          ) : cList.length === 0 ? (
            <p className="py-1.5 text-[12px] text-[#9aa0a6]">まだコメントはありません</p>
          ) : (
            cList.map((c) => (
              <div key={c.id} className="flex gap-2 py-1.5">
                <span className="mt-0.5 h-[26px] w-[26px] flex-shrink-0 overflow-hidden rounded-full">
                  {c.profiles?.avatar_url ? (
                    <img src={srcCdn(c.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center" style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}>
                      <img src="/icons/icon-leaf.webp" alt="" style={{ width: 12, height: 12 }} />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-white px-2.5 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11.5px] font-bold text-[#1c1e21]">{c.profiles?.display_name ?? "むらびと"}</span>
                    <span className="num flex-shrink-0 text-[10px] text-[#b0b3b8]">{relTime(c.created_at)}</span>
                  </div>
                  <p className="break-words text-[13px] leading-relaxed text-[#33363a]">{c.body}</p>
                </div>
              </div>
            ))
          )}
          {me ? (
            <div className="mt-1.5 flex items-end gap-1.5">
              <textarea
                value={cBody}
                onChange={(e) => setCBody(e.target.value)}
                rows={1}
                placeholder="コメントで応援する"
                className="min-h-[38px] flex-1 resize-none rounded-full border border-[#dcdfe4] bg-white px-3.5 py-2 text-[13.5px] leading-snug outline-none focus:border-[#2CB7DE]"
              />
              <button
                onClick={submitComment}
                disabled={!cBody.trim() || cSending}
                aria-label="コメントを送信"
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-35"
                style={{ background: "#2CB7DE" }}
              >
                {cSending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.7 3.3 4.1 10c-.9.4-.8 1.6.1 1.9l6 2 2 5.9c.3.9 1.6 1 1.9.1l6.7-16.6z" />
                    <path d="M20.7 3.3 10.2 13.9" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <p className="pt-1 text-[11.5px] text-[#9aa0a6]">コメントするにはログインしてください</p>
          )}
        </div>
      )}
    </div>
  );
}
