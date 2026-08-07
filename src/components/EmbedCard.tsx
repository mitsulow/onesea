"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

export interface OGPEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  platform?: string;
}

function getInstagramPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
  return match ? match[1] : null;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getTweetId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

const IG_HEADER = 54; // 埋め込み上部（アバター+名前）の高さ
const IG_FOOTER = 168; // ★「Instagramでもっと見る」リンク行まで含めて切り落とす // 下部（♡💬↗ボタン列+リンク行）の高さ

/** Instagramのメディア部分だけを見せる埋め込み */
function InstagramMediaOnly({ igId }: { igId: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState<number | null>(null); // iframe全体の実寸

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.origin.includes("instagram.com")) return;
      if (e.source !== frameRef.current?.contentWindow) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const height = d?.details?.height ?? d?.height;
        if (typeof height === "number" && height > 200) setH(height);
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // 実寸が届いたらヘッダーと下ボタン列を切り落とし、届くまでは全体表示
  const cropped = h != null && h > IG_HEADER + IG_FOOTER + 120;
  return (
    <div
      className="relative mt-2 overflow-hidden rounded-xl border border-[#ede5d8] bg-[#faf8f2]"
      style={{ height: cropped ? h! - IG_HEADER - IG_FOOTER : 560 }}
    >
      <iframe
        ref={frameRef}
        src={`https://www.instagram.com/p/${igId}/embed/`}
        className="absolute w-full"
        style={{
          height: h ?? 560,
          border: "none",
          top: cropped ? -IG_HEADER : 0,
        }}
        scrolling="no"
        loading="lazy"
        allowFullScreen
        title="Instagram post"
      />
    </div>
  );
}

/**
 * SNS URL の自動埋め込み — クリック・トゥ・プレイ方式。
 * 普段はサムネ画像だけ（フィードが軽い）、タップした瞬間その場のiframeで再生。
 * 動画・画像のデータは各SNSのCDN→視聴者に直接流れ、OneSeaのサーバーは通らない。
 * 外部サイトへ飛ばさない=無限フィードに吸われず、コトヅテに留まる。
 */
export function EmbedCard({ embed }: { embed: OGPEmbed }) {
  const url = embed.url;
  const [on, setOn] = useState(false);

  const igId = getInstagramPostId(url);
  const ytId = getYouTubeId(url);
  const tweetId = getTweetId(url);

  /* YouTube: サムネはYouTube公式CDNの静止画（無料・軽量）→タップでその場再生 */
  if (ytId) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-[#ede5d8]">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          {on ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOn(true);
              }}
              className="absolute inset-0 h-full w-full"
              aria-label="動画を再生"
            >
              <img
                src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-black/15" />
              <span
                className="absolute left-1/2 top-1/2 flex h-12 w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl text-[20px] text-white shadow-lg"
                style={{ background: "rgba(200,30,30,.92)" }}
              >
                ▶
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Instagram: メディア部分だけ表示。
     埋め込みiframeはpostMessageで実寸の高さを教えてくるので、
     それを受けてヘッダー(54px)と下のボタン列(約102px)を枠外にはみ出させて隠す。
     動画はiframe内の▶を押すまで再生されない。loading=lazyで画面に近い枠だけ読込 */
  if (igId) {
    return <InstagramMediaOnly igId={igId} />;
  }

  /* X: タップするまでiframeを読まない */
  if (tweetId) {
    if (on) {
      return (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#ede5d8] bg-[#faf8f2]">
          <iframe
            src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=light`}
            className="w-full"
            style={{ height: "560px", border: "none" }}
            scrolling="no"
            loading="lazy"
            title="Post"
          />
        </div>
      );
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOn(true);
        }}
        className="relative mt-2 block w-full overflow-hidden rounded-xl border border-[#ede5d8] bg-[#faf8f2] text-left"
        aria-label="投稿をここで表示"
      >
        {embed.image ? (
          <img src={embed.image} alt="" loading="lazy" className="h-44 w-full object-cover" />
        ) : (
          <div
            className="flex h-32 flex-col items-center justify-center gap-1.5"
            style={{
              background: igId
                ? "linear-gradient(45deg,#f9ce34,#ee2a7b 50%,#6228d7)"
                : "#0f1419",
            }}
          >
            <span className="text-[34px] drop-shadow">{igId ? "📷" : "𝕏"}</span>
            <span className="text-[11px] font-extrabold tracking-wider text-white/90">
              {igId ? "Instagram の投稿" : "X のポスト"}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 p-2.5">
          <div className="min-w-0">
            {embed.title && (
              <div className="line-clamp-1 text-xs font-medium text-[#4a4438]">{embed.title}</div>
            )}
            <div className="text-[10.5px] text-[#b0a898]">{igId ? "Instagram" : "X"}</div>
          </div>
          <span className="flex-shrink-0 rounded-full bg-[#c94d3a] px-3 py-1.5 text-[11px] font-extrabold text-white">
            ここで見る ▶
          </span>
        </div>
      </button>
    );
  }

  /* その他のリンク: OGPカード */
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-xl border border-[#ede5d8] no-underline transition-colors hover:bg-[#faf8f2]"
    >
      {embed.image && <img src={embed.image} alt="" loading="lazy" className="h-36 w-full object-cover" />}
      <div className="p-2.5">
        <div className="line-clamp-2 text-xs font-medium text-[#4a4438]">{embed.title}</div>
        {embed.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-[#b0a898]">{embed.description}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-[#b0a898]">
          {embed.platform && (
            <span className="rounded bg-[#f4f0e6] px-1.5 py-0.5 capitalize">{embed.platform}</span>
          )}
          <span className="truncate">{new URL(url).hostname}</span>
        </div>
      </div>
    </a>
  );
}
