"use client";

import { useRouter } from "next/navigation";
import type { MuraPost } from "@/lib/feed";
import type { Shop } from "@/lib/za";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute統合フィード用の「属性が違うと一目で分かる」カード。
 * むらびとたより = 緑の枠 + 五角形アイコン / 楽市楽座 = 朱の枠 + 商品カード。
 * （Cotozute本体の言の葉は枠なしの素の行 = PostCard）
 */

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "今";
  if (s < 3600) return `${Math.floor(s / 60)}分`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const PENTAGON = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";

/** ⛺ むらびとたより（セカイムラ発）— 緑の枠・五角形アイコン */
export function MuraFeedCard({ mura }: { mura: MuraPost }) {
  const router = useRouter();
  const v = mura.villages;
  return (
    <div
      onClick={() => v && router.push(`/sekai/village/${v.id}`)}
      className="my-2 cursor-pointer rounded-xl border-2 px-3 py-2.5 active:opacity-90"
      style={{ borderColor: "#4a9a5acc", background: "linear-gradient(150deg,#f2faf0,#fbfdf8)" }}
    >
      <div className="flex items-center gap-2">
        {/* 五角形アイコン */}
        {mura.profiles?.avatar_url ? (
          <img
            src={mura.profiles.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-[36px] w-[36px] flex-shrink-0 object-cover"
            style={{ clipPath: PENTAGON }}
          />
        ) : (
          <span
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center bg-[#a8cca8] text-[15px]"
            style={{ clipPath: PENTAGON }}
          >
            ⛺
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-extrabold text-[#2a5a38]">
            {v ? `${v.name}${v.prefecture ? `（${v.prefecture}）` : ""}` : "セカイムラ"}
          </div>
          <div className="truncate text-[10.5px] text-[#6a9a78]">
            {mura.profiles?.display_name ?? "むらびと"}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white"
            style={{ background: "#4a9a5a" }}
          >
            ⛺ むらびとたより
          </span>
          <span className="text-[10px] text-[#8ab89a]">{relTime(mura.created_at)}</span>
        </div>
      </div>
      {mura.kind === "event" && mura.event_at && (
        <div className="mt-1.5 inline-block rounded-full bg-[#4a9a5a]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#2a7a48]">
          📅 イベント {new Date(mura.event_at).getMonth() + 1}/{new Date(mura.event_at).getDate()}
        </div>
      )}
      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#3a4438]">
        {mura.body}
      </p>
      {mura.photo_url && (
        <img src={mura.photo_url} alt="" loading="lazy" className="mt-1.5 max-h-52 rounded-lg object-cover" />
      )}
    </div>
  );
}

/** 🏮 楽市楽座の出品 — 朱の枠・商品カード */
export function ShopFeedCard({ shop }: { shop: Shop }) {
  const router = useRouter();
  const thumb = shop.thumb_urls?.[0] ?? shop.image_urls[0] ?? null;
  return (
    <div
      onClick={() => router.push(`/za/${shop.id}`)}
      className="my-2 flex cursor-pointer gap-2.5 rounded-xl border-2 p-2.5 active:opacity-90"
      style={{ borderColor: "#c94d3acc", background: "linear-gradient(150deg,#fff7ef,#fffdf6)" }}
    >
      <div className="h-[74px] w-[74px] flex-shrink-0 overflow-hidden rounded-lg bg-[#f2ede4]">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 60%,#5a7d4a 100%)" }}
          >
            <img src="/rakuichi/logo-emblem.webp" alt="" className="h-9 w-9 rounded-full object-cover opacity-90" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white"
            style={{ background: "#c94d3a" }}
          >
            🏮 楽市楽座
          </span>
          <span className="flex-shrink-0 text-[10px] text-[#c8a088]">{relTime(shop.created_at)}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-[13.5px] font-bold leading-snug text-[#3a3428]">{shop.name}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="num text-[14px] font-extrabold" style={{ color: "#c94d3a" }}>
            {shop.market === "ichi" ? "0円・物々交換" : shop.price_jpy != null ? `¥${shop.price_jpy.toLocaleString()}` : ""}
          </span>
          <span className="truncate text-[10.5px] text-[#a09888]">
            {shop.profiles?.display_name ?? "むらびと"}
          </span>
        </div>
      </div>
    </div>
  );
}
