import { createClient } from "@/lib/supabase/client";

/** OneSeaブログ（アメブロ引っ越し先 + 新規投稿）。
 *  予約投稿: publish_at が未来の間はRLSで非公開 → 時刻が来ると自動公開（cron不要）。
 *  削除機能は意図的に無い（過去記事を1つも消さない誓い 2026-08-13）。 */

export interface BlogPost {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  body_html: string;
  genre: string | null;
  posted_at: string;
  publish_at: string;
  status: string;
  source: string;
  thumb_url: string | null;
  hashtags: string[] | null;
}

export interface BlogListItem {
  slug: string;
  title: string;
  genre: string | null;
  posted_at: string;
  publish_at: string;
  thumb_url: string | null;
}

export const BLOG_PAGE_SIZE = 20;

export async function blogOwner(username: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();
  return data ?? null;
}

export async function blogArchive(userId: string): Promise<{ months: Array<[string, number]>; genres: Array<[string, number]>; total: number }> {
  const supabase = createClient();
  const { data } = await supabase.rpc("blog_archive", { p_user: userId });
  return (data as never) ?? { months: [], genres: [], total: 0 };
}

export async function blogList(
  userId: string,
  opts: { month?: string; genre?: string; page?: number } = {}
): Promise<BlogListItem[]> {
  const supabase = createClient();
  let q = supabase
    .from("blog_posts")
    .select("slug, title, genre, posted_at, publish_at, thumb_url")
    .eq("user_id", userId)
    .order("posted_at", { ascending: false });
  if (opts.month) {
    // JSTの月境界
    const [y, m] = opts.month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1) - 9 * 3600000).toISOString();
    const end = new Date(Date.UTC(y, m, 1) - 9 * 3600000).toISOString();
    q = q.gte("posted_at", start).lt("posted_at", end);
  }
  if (opts.genre) q = opts.genre === "その他" ? q.is("genre", null) : q.eq("genre", opts.genre);
  const page = opts.page ?? 0;
  q = q.range(page * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE + BLOG_PAGE_SIZE - 1);
  const { data } = await q;
  return (data as BlogListItem[]) ?? [];
}

export async function blogPost(userId: string, slug: string): Promise<BlogPost | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as BlogPost) ?? null;
}

/** 前後の記事（アメブロと同じ「次の記事/前の記事」ナビ用） */
export async function blogNeighbors(userId: string, postedAt: string) {
  const supabase = createClient();
  const [prev, next] = await Promise.all([
    supabase.from("blog_posts").select("slug, title").eq("user_id", userId).lt("posted_at", postedAt).order("posted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("blog_posts").select("slug, title").eq("user_id", userId).gt("posted_at", postedAt).order("posted_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  return { prev: prev.data ?? null, next: next.data ?? null };
}

/** 表示前の無害化+アメブロHTMLの復元。
 *  - script/イベントハンドラ/javascript: を除去
 *  - アメブロの遅延読み込みを解除: <noscript>の重複を消し、プレースホルダSVGの
 *    srcを data-src(本物のURL) に差し替え（これをしないと画像が1枚も表示されない）
 *  - 裸のアメブロ記事リンク(リブログ先など)は押しやすいリンクカードに */
export function sanitizeHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
  // 遅延読み込み解除
  out = out.replace(/<noscript>[\s\S]*?<\/noscript>/gi, "");
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const ds = tag.match(/data-src="([^"]+)"/);
    if (ds && /src="data:image\/svg[^"]*"/.test(tag)) {
      return tag.replace(/src="data:image\/svg[^"]*"/, `src="${ds[1]}" loading="lazy"`);
    }
    return tag;
  });
  // 裸のアメブロ記事リンク → カード（リブログ先への導線）
  out = out.replace(
    /<a href="(https:\/\/ameblo\.jp\/[\w.-]+\/entry-\d+\.html)"([^>]*)>\s*(?:\1|こちら|リブログ元の記事)\s*<\/a>/g,
    '<div class="blog-embed"><a href="$1" target="_blank" rel="noopener noreferrer">📖 リブログ元の記事を読む<span class="blog-embed-url">$1</span></a></div>'
  );
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** エディタのテキスト → HTML。
 *  行がYouTube URLだけなら埋め込み、Amazon URLだけならリンクカード、画像タグはそのまま。 */
export function composeToHtml(text: string): string {
  const ytRe = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,20})\S*$/;
  const amzRe = /^https?:\/\/(?:www\.)?(?:amazon\.co\.jp|amazon\.com|amzn\.to|amzn\.asia)\/\S+$/;
  const urlRe = /^https?:\/\/\S+$/;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return "<p>&nbsp;</p>";
      if (t.startsWith("<img ") || t.startsWith('<div class="blog-embed"')) return t;
      const yt = t.match(ytRe);
      if (yt) {
        return `<div class="blog-yt"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
      if (amzRe.test(t)) {
        return `<div class="blog-embed"><a href="${esc(t)}" target="_blank" rel="noopener noreferrer nofollow">🛒 Amazonで見る<span class="blog-embed-url">${esc(t)}</span></a></div>`;
      }
      if (urlRe.test(t)) {
        return `<p><a href="${esc(t)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></p>`;
      }
      return `<p>${esc(t)}</p>`;
    })
    .join("\n");
}

export function jstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function jstDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
