"use client";

/** ブログ投稿エディタ（アメブロの投稿のしやすさを踏襲）。
 *  - 画像: 選ぶだけで本文に挿入（R2アップロード）
 *  - YouTube/Amazon: URLを1行貼るだけで自動埋め込み
 *  - 予約投稿: 未来の日時を選ぶとその時刻に自動公開（それまでは本人にしか見えない）
 *  - 削除機能は無い（過去記事を1つも消さない方針） */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { composeToHtml, sanitizeHtml, BlogPost } from "@/lib/blog";
import { compressImage } from "@/lib/images";

function BlogEditor() {
  const router = useRouter();
  const sp = useSearchParams();
  const editSlug = sp.get("edit");

  const [me, setMe] = useState<{ id: string; username: string | null } | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [rawHtml, setRawHtml] = useState<string | null>(null); // 引っ越し記事の編集はHTMLのまま
  const [when, setWhen] = useState(""); // 予約日時 (datetime-local)
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user;
      if (!u) { setMsg("ログインが必要です"); return; }
      const { data: prof } = await supabase.from("profiles").select("username").eq("id", u.id).maybeSingle();
      setMe({ id: u.id, username: prof?.username ?? null });
      const { data: gs } = await supabase.from("blog_posts").select("genre").eq("user_id", u.id).not("genre", "is", null).limit(1000);
      setGenres([...new Set((gs ?? []).map((g) => g.genre as string))]);
      if (editSlug) {
        const { data: p } = await supabase.from("blog_posts").select("*").eq("user_id", u.id).eq("slug", editSlug).maybeSingle();
        if (p) {
          const post = p as BlogPost;
          setTitle(post.title);
          setGenre(post.genre ?? "");
          if (post.source === "onesea") setText(htmlToText(post.body_html));
          else setRawHtml(post.body_html); // アメブロ引っ越し記事はHTMLをそのまま保持して編集(壊さない)
          const d = new Date(new Date(post.publish_at).getTime() + 9 * 3600000);
          setWhen(d.toISOString().slice(0, 16));
        }
      }
    });
  }, [editSlug]);

  const htmlToText = (html: string) =>
    html
      .replace(/<div class="blog-yt"><iframe src="https:\/\/www\.youtube\.com\/embed\/([\w-]+)"[\s\S]*?<\/div>/g, "https://www.youtube.com/watch?v=$1")
      .replace(/<p>&nbsp;<\/p>/g, "")
      .replace(/<p>([\s\S]*?)<\/p>/g, "$1\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  const insertAtCursor = (snippet: string) => {
    const ta = taRef.current;
    if (!ta) { setText((t) => t + "\n" + snippet + "\n"); return; }
    const s = ta.selectionStart ?? text.length;
    setText(text.slice(0, s) + "\n" + snippet + "\n" + text.slice(s));
  };

  const onPickImage = async (f: File | null) => {
    if (!f || !me) return;
    setMsg("画像をアップロード中...");
    try {
      const blob = await compressImage(f, 1600, 0.85);
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("folder", "blog-images");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.url) {
        insertAtCursor(`<img src="${d.url}" alt="">`);
        setMsg("");
      } else setMsg("アップロードに失敗しました");
    } catch {
      setMsg("アップロードに失敗しました");
    }
  };

  const save = async () => {
    if (!me || !title.trim()) { setMsg("タイトルを入れてください"); return; }
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    const bodyHtml = rawHtml !== null ? rawHtml : composeToHtml(text);
    // 予約日時: 未指定なら今すぐ公開。未来ならその時刻まで非公開(RLSが自動で守る)
    const pub = when ? new Date(new Date(when + ":00").getTime()).toISOString() : new Date().toISOString();
    const slug = editSlug ?? `entry-${Date.now()}`;
    const row = {
      user_id: me.id,
      slug,
      title: title.trim(),
      body_html: bodyHtml,
      genre: genre.trim() || null,
      posted_at: pub,
      publish_at: pub,
      status: "published",
      source: rawHtml !== null ? "ameba" : "onesea",
      updated_at: new Date().toISOString(),
    };
    const { error } = editSlug
      ? await supabase.from("blog_posts").update(row).eq("user_id", me.id).eq("slug", editSlug)
      : await supabase.from("blog_posts").insert(row);
    setSaving(false);
    if (error) { setMsg(`保存できませんでした: ${error.message}`); return; }
    router.push(`/blog/${me.username ?? ""}/${slug}`);
  };

  const scheduled = when && new Date(when + ":00").getTime() > Date.now();

  return (
    <main className="min-h-screen bg-[#f4f6f2] pb-28">
      <header className="sticky top-0 z-40 border-b border-[#e0e4d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[52px] max-w-[760px] items-center justify-between px-3">
          <span className="text-[14px] font-extrabold text-[#3a4030]">{editSlug ? "記事を編集" : "ブログを書く"}</span>
          <span className="flex items-center gap-2">
            {me?.username && (
              <Link href={`/blog/${me.username}`} className="text-[12px] font-bold text-[#6a7260] no-underline">記事一覧</Link>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-40"
              style={{ background: scheduled ? "#b07a2a" : "#5a8a3c" }}
            >
              {saving ? "保存中..." : scheduled ? "⏰予約投稿する" : "公開する"}
            </button>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-3 pt-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          className="w-full rounded-xl border border-[#dde2d2] bg-white px-4 py-3 text-[16px] font-bold text-[#2c3226] outline-none focus:border-[#5a8a3c]"
        />

        <div className="mt-2 flex gap-2">
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            list="blog-genres"
            placeholder="ジャンル（テーマ）"
            className="min-w-0 flex-1 rounded-xl border border-[#dde2d2] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#5a8a3c]"
          />
          <datalist id="blog-genres">{genres.map((g) => <option key={g} value={g} />)}</datalist>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl border border-[#dde2d2] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#5a8a3c]"
            title="予約投稿（未来の日時を選ぶとその時刻に自動公開）"
          />
        </div>
        {scheduled && (
          <p className="mt-1 text-[11px] font-bold text-[#b07a2a]">⏰ 予約投稿: 公開時刻まではURLを開いても「ブログ記事が無いようです」になります（あなたにだけ見えます）</p>
        )}

        {/* ツールバー */}
        <div className="mt-2 flex items-center gap-2">
          <label className="cursor-pointer rounded-full border border-[#dde2d2] bg-white px-3.5 py-2 text-[12px] font-bold text-[#5a8a3c]">
            📷 画像
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
          </label>
          <span className="text-[10.5px] leading-tight text-[#9aa28e]">YouTube や Amazon のURLは、1行で貼るだけで自動で埋め込みになります</span>
          <button onClick={() => setPreview((v) => !v)} className="ml-auto flex-shrink-0 rounded-full border border-[#dde2d2] bg-white px-3.5 py-2 text-[12px] font-bold text-[#6a7260]">
            {preview ? "編集にもどる" : "プレビュー"}
          </button>
        </div>

        {msg && <p className="mt-2 text-[12px] font-bold text-[#c05030]">{msg}</p>}

        {preview ? (
          <div className="mt-2 rounded-xl border border-[#e4e8dc] bg-white px-4">
            <div className="blog-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml !== null ? rawHtml : composeToHtml(text)) }} />
          </div>
        ) : rawHtml !== null ? (
          <textarea
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
            rows={22}
            className="mt-2 w-full rounded-xl border border-[#dde2d2] bg-white p-4 font-mono text-[12px] leading-relaxed outline-none focus:border-[#5a8a3c]"
          />
        ) : (
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={22}
            placeholder={"本文を書く…\n\n・改行はそのまま反映\n・YouTubeのURLを1行で貼ると動画埋め込み\n・AmazonのURLを1行で貼ると商品カード"}
            className="mt-2 w-full rounded-xl border border-[#dde2d2] bg-white p-4 text-[14.5px] leading-relaxed outline-none focus:border-[#5a8a3c]"
          />
        )}
      </div>
    </main>
  );
}

export default function BlogNewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f6f2]" />}>
      <BlogEditor />
    </Suspense>
  );
}
