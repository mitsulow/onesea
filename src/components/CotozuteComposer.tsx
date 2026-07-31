"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";
import { EmbedCard, OGPEmbed } from "./EmbedCard";
import { SnsIcon } from "./SnsIcon";
import { ImagePair, uploadImagePair } from "@/lib/images";
import promptsData from "@/data/cotozute-prompts.json";

const DAILY_PROMPTS: string[] = promptsData.prompts;
function todayPrompt(): string {
  const now = new Date();
  const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_PROMPTS[doy % DAILY_PROMPTS.length];
}

const URL_REGEX = /https?:\/\/[^\s]+/g;

const PLATFORMS: Array<[string, string]> = [["instagram", "Instagram"], ["x", "X"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["note", "note"], ["ameblo", "アメブロ"], ["facebook", "Facebook"]];

function detectPlatform(url: string): string | undefined {
  if (/instagram\.com/.test(url)) return "instagram";
  if (/x\.com|twitter\.com/.test(url)) return "x";
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/facebook\.com/.test(url)) return "facebook";
  if (/note\.com/.test(url)) return "note";
  if (/ameblo\.jp/.test(url)) return "ameblo";
  return undefined;
}

async function fetchOGP(url: string): Promise<OGPEmbed | null> {
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.title && !data.description && !data.image) {
      return { url, title: new URL(url).hostname, platform: detectPlatform(url) };
    }
    return {
      url,
      title: data.title || new URL(url).hostname,
      description: data.description,
      image: data.image,
      platform: detectPlatform(url),
    };
  } catch {
    return null;
  }
}

/**
 * Cotozute 投稿欄（楽市楽座「情緒」から移植）。
 * 本文や URL 欄に SNS のリンクを貼ると自動で取り込み、綺麗にリサイズして埋め込む。
 */
export function CotozuteComposer({ onPosted }: { onPosted?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [embed, setEmbed] = useState<OGPEmbed | null>(null);
  const [loadingOGP, setLoadingOGP] = useState(false);
  const [images, setImages] = useState<ImagePair[]>([]);
  const [uploading, setUploading] = useState(false);
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // URL を検出したら OGP を自動取得（本文・URL欄のどちらでも）
  useEffect(() => {
    const urlFromInput = linkUrl.trim().match(URL_REGEX)?.[0];
    const urlFromBody = body.match(URL_REGEX)?.[0];
    const firstUrl = urlFromInput || urlFromBody || null;

    if (!firstUrl) {
      setEmbed(null);
      lastFetchedUrl.current = null;
      return;
    }
    if (firstUrl === lastFetchedUrl.current) return;
    lastFetchedUrl.current = firstUrl;

    const timer = setTimeout(async () => {
      setLoadingOGP(true);
      setEmbed(await fetchOGP(firstUrl));
      setLoadingOGP(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [body, linkUrl]);

  const removeEmbed = () => {
    setEmbed(null);
    setLinkUrl("");
    lastFetchedUrl.current = "__removed__";
  };

  const login = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (error) setMessage(`ログインエラー: ${error.message}`);
  };

  const submit = async () => {
    if (!user || (!body.trim() && !embed && images.length === 0) || sending) return;
    setSending(true);
    setMessage(null);
    const supabase = createClient();

    await ensureProfile(user);

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      body: body.trim(),
      image_urls: images.map((i) => i.full),
      thumb_urls: images.map((i) => i.thumb),
      embed: embed ?? null,
    });

    setSending(false);
    if (error) {
      setMessage(`投稿できませんでした: ${error.message}`);
      return;
    }
    setBody("");
    setLinkUrl("");
    setEmbed(null);
    setImages([]);
    lastFetchedUrl.current = null;
    setExpanded(false);
    setMessage("投稿しました 🌿");
    onPosted?.();
  };

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mb-2 rounded-xl border border-[#e8dcc4] bg-white p-3 text-center">
        <p className="mb-2 text-[12.5px] leading-relaxed text-[#8a8070]">
          いまの気持ちを、ひとこと。
        </p>
        <button
          onClick={login}
          className="w-full rounded-xl py-3 text-[14px] font-extrabold text-white"
          style={{ background: "#c94d3a" }}
        >
          ログインして投稿する
        </button>
        {message && <p className="mt-2 text-[11px] text-[#c05030]">{message}</p>}
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="mb-2 w-full rounded-xl border border-[#e8dcc4] px-3.5 py-3 text-left text-[13.5px] text-[#8a8070]"
        style={{ background: "linear-gradient(135deg,#fffaf0 0%,#fdf6e9 100%)" }}
      >
        ✏️ {todayPrompt()}
      </button>
    );
  }

  return (
    <div className="mb-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={todayPrompt()}
        maxLength={500}
        rows={3}
        autoFocus
        className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
      />

      {/* 写真（サムネ+本体の2枚方式で自動圧縮） */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
        {images.map((img, i) => (
          <div key={img.thumb} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.thumb} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              aria-label="画像を外す"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length < 1 && (
          <label className="flex h-16 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8dcc4] bg-white px-4 text-[12.5px] font-bold text-[#8a7a5a]">
            {uploading ? (
              "⏳ 圧縮中..."
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h3l1.5-2.2A1 1 0 0 1 9.3 4.4h5.4a1 1 0 0 1 .8.4L17 7h3a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V8.5A1.5 1.5 0 0 1 4 7Z" />
              <circle cx="12" cy="13" r="3.6" />
            </svg>
                写真
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                if (!user || !e.target.files?.[0] || uploading) return;
                setUploading(true);
                const pair = await uploadImagePair("post-images", user.id, e.target.files[0]);
                if (pair) setImages([pair]); // 1投稿につき1枚
                setUploading(false);
              }}
            />
          </label>
        )}
      </div>

      {/* OGP プレビュー */}
      {loadingOGP && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#b0a898]">
          <span className="animate-pulse">⏳</span> リンクを取り込んでいます...
        </div>
      )}
      {embed && !loadingOGP && (
        <div className="relative mt-1">
          <div className="px-1 py-0.5 text-[10px] font-medium text-[#4a8a5c]">✓ 取り込みました</div>
          <EmbedCard embed={embed} />
          <button
            type="button"
            onClick={removeEmbed}
            aria-label="埋め込みを外す"
            className="absolute right-1 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* SNSリンク貼り付け */}
      <div className="mt-2.5 rounded-xl border-2 border-dashed border-[#c94d3a]/30 bg-[#c94d3a]/5 p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-base">🔗</span>
          <span className="text-xs font-medium text-[#5a5448]">
            SNS取り込めます
          </span>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {PLATFORMS.map(([id, label]) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-[#ede5d8] bg-white px-2 py-0.5 text-[10.5px] text-[#b0a898]"
            >
              <SnsIcon platform={id} size={12} />
              {label}
            </span>
          ))}
        </div>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="URLをここに貼り付け（https://...）"
          className="w-full rounded-lg border border-[#ede5d8] bg-white px-3 py-2 text-xs outline-none focus:border-[#c94d3a]"
        />
      </div>

      {/* 送信バー */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#c0b8a8]">
          {message ?? `${body.length}/500`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setExpanded(false);
              setBody("");
              removeEmbed();
            }}
            className="rounded-xl px-3 py-2 text-[12.5px] font-bold text-[#a09888]"
          >
            キャンセル
          </button>
          <button
            onClick={submit}
            disabled={(!body.trim() && !embed && images.length === 0) || sending || uploading}
            className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {sending ? "投稿中..." : "💭 投稿"}
          </button>
        </div>
      </div>
    </div>
  );
}
