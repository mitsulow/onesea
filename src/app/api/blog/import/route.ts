import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Put, r2Ready } from "@/lib/r2";

/**
 * ブログ引っ越しAPI（アメブロ / note）。元ブログは公開ページを「読むだけ」— 一切書き込まない。
 * クライアントが {action:'list'} でページごとの記事ID一覧を取り、{action:'entry'} で1記事ずつ取込む
 * （サーバレスのタイムアウトを避けるため1呼び出し=1記事。画像はR2へコピーしてURLを書き換え）。
 * 取り込みは呼び出したユーザー自身のブログとして保存される（RLS準拠・わらわ〜限定）。
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OneSeaBlogImport/1.0" };

/** window.INIT_DATA = {...} を波括弧の対応を数えて取り出す（文字列内の括弧は無視） */
function extractInitData(html: string): Record<string, unknown> | null {
  const at = html.indexOf("window.INIT_DATA");
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0, inStr = false, escp = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (escp) escp = false;
      else if (c === "\\") escp = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: UA, cache: "no-store" });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return r.text();
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 本文中の画像(stat.ameba.jp / assets.st-note.com)をR2へコピーしてURL書き換え */
async function mirrorImages(userId: string, key: string, body: string): Promise<{ body: string; thumb: string | null }> {
  if (!r2Ready()) return { body, thumb: null };
  const found = body.match(/https:\/\/(?:stat\.ameba\.jp\/user_images|assets\.st-note\.com\/(?:production\/uploads|img))\/[^"'\s<>\\)]+/g) ?? [];
  const bases = [...new Set(found.map((u) => u.split("?")[0]))];
  let thumb: string | null = null;
  let n = 0;
  for (const base of bases.slice(0, 40)) {
    try {
      const r = await fetch(base, { headers: UA });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") ?? "image/jpeg";
      if (!ct.startsWith("image/")) continue;
      const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : ct.includes("webp") ? "webp" : "jpg";
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) continue;
      const r2url = await r2Put(`blog/${userId}/${key}/${n}.${ext}`, bytes, ct);
      if (!r2url) continue;
      // 「?クエリ付き」参照を先にクエリなしへ正規化 → 単純置換で一括書き換え
      body = body.replace(new RegExp(escRe(base) + "\\?[^\"'\\s<>\\\\)]*", "g"), base).split(base).join(r2url);
      if (!thumb) thumb = r2url;
      n++;
    } catch { /* 取得できない画像は元URLのまま残す(消さない) */ }
  }
  return { body, thumb };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { source, blogId, action, page, entryId } = await req.json();
  if (!/^[\w.-]{1,60}$/.test(String(blogId ?? ""))) return NextResponse.json({ error: "bad blogId" }, { status: 400 });

  try {
    if (action === "list") {
      if (source === "ameba") {
        const html = await fetchText(`https://ameblo.jp/${blogId}/entrylist-${Number(page) || 1}.html`);
        const d = extractInitData(html);
        const pm = ((d?.entryState as Record<string, unknown>)?.blogPageMap ?? {}) as Record<string, { data?: number[] }>;
        let ids: number[] = [];
        for (const v of Object.values(pm)) ids = v.data ?? [];
        return NextResponse.json({ ids: ids.map(String), last: ids.length === 0 });
      }
      if (source === "note") {
        const r = await fetch(`https://note.com/api/v2/creators/${blogId}/contents?kind=note&page=${Number(page) || 1}`, { headers: UA, cache: "no-store" });
        if (!r.ok) return NextResponse.json({ error: "note user not found" }, { status: 404 });
        const d = await r.json();
        const contents = d?.data?.contents ?? [];
        return NextResponse.json({ ids: contents.map((c: { key: string }) => c.key), last: !!d?.data?.isLastPage || contents.length === 0 });
      }
      return NextResponse.json({ error: "bad source" }, { status: 400 });
    }

    if (action === "entry") {
      const slug = `entry-${entryId}`;
      const { data: exists } = await supabase.from("blog_posts").select("slug").eq("user_id", user.id).eq("slug", slug).maybeSingle();
      if (exists) return NextResponse.json({ ok: true, skipped: true });

      let row: Record<string, unknown> | null = null;
      if (source === "ameba") {
        const html = await fetchText(`https://ameblo.jp/${blogId}/entry-${entryId}.html`);
        const d = extractInitData(html);
        const em = ((d?.entryState as Record<string, unknown>)?.entryMap ?? {}) as Record<string, Record<string, unknown>>;
        const e = em[String(entryId)] ?? Object.values(em)[0];
        if (!e || !e.entry_text) return NextResponse.json({ ok: false, reason: "非公開(アメンバー限定など)のためスキップ" });
        const m = await mirrorImages(user.id, String(entryId), String(e.entry_text));
        row = {
          user_id: user.id, slug,
          title: (e.entry_title as string) || "(無題)",
          body_html: m.body,
          genre: (e.theme_name as string) || null,
          posted_at: e.entry_created_datetime, publish_at: e.entry_created_datetime,
          status: "published", source: "ameba",
          source_url: `https://ameblo.jp/${blogId}/entry-${entryId}.html`,
          thumb_url: m.thumb,
        };
      } else if (source === "note") {
        const r = await fetch(`https://note.com/api/v3/notes/${entryId}`, { headers: UA, cache: "no-store" });
        if (!r.ok) return NextResponse.json({ ok: false, reason: `note ${r.status}` });
        const d = (await r.json())?.data;
        if (!d?.body) return NextResponse.json({ ok: false, reason: "本文なし(有料記事など)のためスキップ" });
        const m = await mirrorImages(user.id, String(entryId), String(d.body));
        row = {
          user_id: user.id, slug,
          title: d.name || "(無題)",
          body_html: m.body,
          genre: null,
          posted_at: d.publishAt ?? d.publish_at ?? new Date().toISOString(),
          publish_at: d.publishAt ?? d.publish_at ?? new Date().toISOString(),
          status: "published", source: "note",
          source_url: `https://note.com/${blogId}/n/${entryId}`,
          thumb_url: m.thumb ?? d.eyecatch ?? null,
        };
      } else {
        return NextResponse.json({ error: "bad source" }, { status: 400 });
      }

      const { error } = await supabase.from("blog_posts").insert(row);
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "bad action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: String(e).slice(0, 200) });
  }
}
