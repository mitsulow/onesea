"use client";

import { EmbedCard } from "@/components/EmbedCard";
import { SekaiBadge } from "@/components/WarawaBadge";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MuraPost } from "@/lib/feed";
import type { Shop } from "@/lib/za";
import { srcCdn } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute統合フィードのカード（Facebook型）。
 * むらびとたより = 言の葉と同じ体裁で、太字の名前が「拠点名（県）」になるだけ。
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

/** セカイムラ発のたより（FB型・名前欄が拠点名になる） */
export function MuraFeedCard({ mura, onDeleted }: { mura: MuraPost; onDeleted?: () => void }) {
  const [meId, setMeId] = useState<string | null>(null);
  const [amOffice, setAmOffice] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().auth.getSession().then(({ data: { session } }) => {
        const uid = session?.user?.id ?? null;
        setMeId(uid);
        if (uid) import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(uid).then(setAmOffice)).catch(() => {});
      });
    });
  }, []);
  const canDelete = !!meId && (meId === (mura as { user_id?: string }).user_id || amOffice);
  const doDelete = async () => {
    if (!confirm("本当に削除していいですか？")) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("village_posts").delete().eq("id", mura.id);
    setGone(true);
    onDeleted?.();
  };
  if (gone) return null;
  const router = useRouter();
  const v = mura.villages;
  const [expanded, setExpanded] = useState(false);
  const needsFold = mura.body.length > 42 || mura.body.includes("\n");
  return (
    <div className="py-2.5">
      {/* ヘッダー: 拠点名（県）が太字の名前になる */}
      <div className="flex items-center gap-2.5">
        <button onClick={() => v && router.push(`/sekai/village/${v.id}`)} className="flex-shrink-0">
          {/* 個人ではなく拠点(=ページ)のアイコンで発信 — 過去の投稿もセカイムラ◯◯の顔になる */}
          {v?.icon_url ? (
            <img
              src={srcCdn(v.icon_url)}
              alt=""
              className="h-[40px] w-[40px] rounded-full border border-[#dce8dc] object-cover"
            />
          ) : (
            <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-[16px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>
              🏡
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => v && router.push(`/sekai/village/${v.id}`)}
            className="block max-w-full truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21]"
          >
            {v ? v.name : "セカイムラ"}<span className="text-[12px] font-normal text-[#7a9a80]">からの投稿</span> <SekaiBadge size={14} />
          </button>
          <div className="text-[11.5px] leading-tight text-[#8a8d91]">
            {v?.prefecture ? `@${v.prefecture} ・ ` : ""}
            {relTime(mura.created_at)}
            {mura.profiles?.display_name && <span className="ml-1.5">{mura.profiles.display_name}</span>}
          </div>
        </div>
        {/* 右上: 公認拠点の投稿バッジ（緑） + 削除×(本人と事務局) */}
        <span className="flex flex-shrink-0 items-center gap-1.5 self-start">
          <span
            className="rounded-md px-2 py-1 text-[9.5px] font-extrabold text-white"
            style={{ background: "#2a8a4a" }}
          >
            セカイムラ村人投稿
          </span>
          {canDelete && (
            <button
              onClick={doDelete}
              aria-label="削除"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f2f5] text-[13px] font-bold text-[#65676b]"
            >
              ×
            </button>
          )}
        </span>
      </div>

      {mura.kind === "event" && mura.event_at && <EventJoinButton postId={mura.id} />}
      {mura.kind === "event" && mura.event_at && (
        <div className="mt-1.5 inline-block rounded-full bg-[#e8f4ec] px-2 py-0.5 text-[10.5px] font-bold text-[#2a7a48]">
          <img src="/icons/icon-calendar.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> イベント {new Date(mura.event_at).getMonth() + 1}/{new Date(mura.event_at).getDate()}
        </div>
      )}

      {/* 本文（1行 → もっと見る） */}
      <div className="mt-2">
        <p
          className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1c1e21] ${
            expanded ? "" : "line-clamp-1"
          }`}
          onClick={() => !expanded && needsFold && setExpanded(true)}
        >
          {mura.body}
        </p>
        {needsFold && !expanded && (
          <button onClick={() => setExpanded(true)} className="text-[13.5px] text-[#8a8d91]">
            …もっと見る
          </button>
        )}
      </div>

      {/* 写真は左右いっぱい */}
      {mura.photo_url && (
        <div className="-mx-4 mt-2">
          <img src={srcCdn(mura.photo_url)} alt="" loading="lazy" className="w-full object-cover" style={{ maxHeight: 480 }} />
        </div>
      )}
      {mura.embed && (
        <div className="mt-2">
          <EmbedCard embed={mura.embed} />
        </div>
      )}

      <div className="mt-2 border-t border-[#f0f2f5] pt-1.5">
        <button
          onClick={() => v && router.push(`/sekai/village/${v.id}`)}
          className="w-full py-1 text-center text-[12.5px] font-bold text-[#4a8a5c]"
        >
          拠点のページへ
        </button>
      </div>
    </div>
  );
}

/** 楽市楽座 横スクロールストリップ用の商品カード */
export function ShopStripCard({ shop }: { shop: Shop }) {
  const router = useRouter();
  const thumb = shop.thumb_urls?.[0] ?? shop.image_urls[0] ?? null;
  return (
    <button
      onClick={() => router.push(`/za/${shop.id}`)}
      className="w-[132px] flex-shrink-0 overflow-hidden rounded-xl border border-[#e8e4da] bg-white text-left shadow-sm"
    >
      <div className="h-[110px] w-full bg-[#f2ede4]">
        {thumb ? (
          <img src={srcCdn(thumb)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 60%,#5a7d4a 100%)" }}
          >
            <img src="/rakuichi/logo-emblem.webp" alt="" className="h-9 w-9 rounded-full object-cover opacity-90" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="line-clamp-2 text-[11.5px] font-bold leading-snug text-[#3a3428]">{shop.name}</div>
        <div className="num mt-0.5 text-[12px] font-extrabold" style={{ color: "#c94d3a" }}>
          {shop.market === "ichi" ? "0円" : shop.price_jpy != null ? `¥${shop.price_jpy.toLocaleString()}` : "値段相談"}
        </div>
      </div>
    </button>
  );
}


/** イベント呼びかけの「参加する」ボタン（Cotozuteフィード用・event_rsvps） */
function EventJoinButton({ postId }: { postId: string }) {
  const [me, setMe] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user?.id ?? null));
    supabase.from("event_rsvps").select("user_id").eq("post_id", postId).then(({ data }) => setCount(data?.length ?? 0));
  }, [postId]);
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    supabase.from("event_rsvps").select("user_id").eq("post_id", postId).eq("user_id", me).maybeSingle().then(({ data }) => setJoined(!!data));
  }, [me, postId]);
  const toggle = async () => {
    if (!me) return;
    const supabase = createClient();
    if (joined) {
      await supabase.from("event_rsvps").delete().eq("post_id", postId).eq("user_id", me);
      setJoined(false); setCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("event_rsvps").upsert({ post_id: postId, user_id: me });
      setJoined(true); setCount((c) => c + 1);
    }
  };
  if (!me) return null;
  return (
    <button
      onClick={toggle}
      className="mr-2 mt-1.5 inline-block rounded-full px-3 py-1 text-[11px] font-extrabold"
      style={joined ? { background: "#e8f4ec", color: "#2a7a48", border: "1px solid #8cc8a0" } : { background: "#2a7a48", color: "#fff" }}
    >
      {joined ? `✓ 参加します（${count}人）` : `参加する${count ? `（${count}人）` : ""}`}
    </button>
  );
}

export function MoaiFeedCard({ post }: { post: import("@/lib/feed").MoaiFeedPost }) {
  const router = useRouter();
  const v = post.moai;
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2.5">
        <button onClick={() => v && router.push(`/moai/${v.id}`)} className="flex-shrink-0">
          {v?.icon_url ? (
            <img src={srcCdn(v.icon_url)} alt="" className="h-[40px] w-[40px] rounded-full border border-[#f0d8d4] object-cover" />
          ) : (
            <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-[16px]" style={{ background: "#f3ded9" }}>🗿</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => v && router.push(`/moai/${v.id}`)} className="block max-w-full truncate text-left text-[14.5px] font-bold leading-tight text-[#1c1e21]">
            {v ? v.name : "MoAI"}<span className="text-[12px] font-normal text-[#a08078]">からの投稿</span>
          </button>
          <div className="text-[11.5px] leading-tight text-[#8a8d91]">{relTime(post.created_at)}{post.profiles?.display_name ? ` ・ ${post.profiles.display_name}` : ""}</div>
        </div>
        <span className="flex-shrink-0 self-start rounded-md px-2 py-1 text-[9.5px] font-extrabold text-white" style={{ background: "#c0392b" }}>モアイからの投稿</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#1c1e21]">{post.body}</p>
      {post.photo_url && (
        <div className="-mx-4 mt-2"><img src={srcCdn(post.photo_url)} alt="" loading="lazy" className="w-full object-cover" style={{ maxHeight: 480 }} /></div>
      )}
    </div>
  );
}
