import { LINKS, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

interface Post {
  body: string | null;
  image_urls: string[] | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

async function fetchPosts(): Promise<Post[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/posts` +
        `?select=body,image_urls,created_at,profiles!posts_user_id_fkey(display_name,username,avatar_url)` +
        `&order=created_at.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Post[];
    return rows.filter(
      (p) => (p.body && p.body.trim()) || (p.image_urls && p.image_urls.length)
    );
  } catch {
    return [];
  }
}

/** Cotozute — 楽市楽座と共通のみんなの言の葉（読むのは誰でも） */
export async function CotozuteFeed() {
  const posts = await fetchPosts();
  return (
    <section
      className="card"
      style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)" }}
    >
      <div className="sec mb-2.5">
        💭 Cotozute{" "}
        <span className="font-normal tracking-normal text-[#c0b8a8]">
          みんなの言の葉
        </span>
      </div>
      {posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">
          言の葉を読み込めませんでした
        </p>
      ) : (
        posts.slice(0, 8).map((p, i) => {
          const pr = p.profiles;
          const d = new Date(p.created_at);
          return (
            <div key={i} className="flex gap-2.5 border-b border-[#f2ece0] py-2.5">
              <div className="flex-shrink-0">
                {pr?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pr.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-[34px] w-[34px] rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px]"
                    style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                  >
                    🌿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="text-[13px] font-bold text-[#4a4438]">
                    {pr?.display_name ?? "むらびと"}
                  </span>
                  <span className="num text-[10.5px] text-[#c0b8a8]">
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                </div>
                {p.body?.trim() && (
                  <p className="break-words text-[13.5px] leading-relaxed text-[#5a5448]">
                    {p.body}
                  </p>
                )}
                {p.image_urls?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt=""
                    loading="lazy"
                    className="mt-1.5 max-w-full rounded-lg"
                  />
                )}
              </div>
            </div>
          );
        })
      )}
      <a
        href={LINKS.rakuzaCotozute}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-xl border border-[#e0d6c6] bg-white py-3 text-center text-[13.5px] font-extrabold text-[#8a7a5a] no-underline"
      >
        Cotozute をすべて見る ↗
      </a>
    </section>
  );
}
