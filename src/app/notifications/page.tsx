"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";
import { NotificationRow, fetchNotifications, markNotifsRead, notifText } from "@/lib/notifications";
import { srcCdn } from "@/lib/images";

/* eslint-disable @next/next/no-img-element */

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 🔔 お知らせページ — 未読は濃く、既読は薄く。開いた時点で全部既読に */
export default function NotificationsPage() {
  const [me, setMe] = useState<User | null>(null);
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) { setRows([]); return; }
      const list = await fetchNotifications(u.id);
      setRows(list);
      // 表示できた時点で既読化（この画面では未読の濃さを保ったまま）
      markNotifsRead(u.id).then(() => {
        window.dispatchEvent(new Event("onesea:notifRefresh"));
      });
    });
  }, []);

  return (
    <main className="pb-24" style={{ background: "#fffdf8", minHeight: "100dvh" }}>
      <TopTone color="#fffdf8" />
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-[#fffdf8]/95 backdrop-blur-sm">
        <div className="flex h-[52px] items-center justify-between px-4">
          <span className="text-[16px] font-extrabold tracking-[2px] text-[#3a3428]">🔔 お知らせ</span>
          <AvatarMenu ring="#c94d3a" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px]">
        {rows === null ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">読み込み中...</p>
        ) : !me ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">ログインするとお知らせが届きます</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#a09888]">
            まだお知らせはありません。
            <br />コメント・返信・ブツブツ交換の提案・シェアがここに届きます
          </p>
        ) : (
          groupLikes(rows).map((g) => {
            if (g.kind === "likes") {
              // ハートは束ねて1行 — 付けた人のアイコンをずらり（バッジ数には入れない）
              return (
                <Link key={g.key} href={g.url} className="block no-underline">
                  <div className="flex items-start gap-2.5 border-b border-[#f0ece0] px-4 py-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#fdeef0] text-[16px]">❤️</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-snug text-[#3a3428]">
                        記事にハートが付きました（{g.items.length}）
                      </div>
                      <div className="mt-1 flex flex-wrap items-center">
                        {g.items.slice(0, 14).map((n2, i) => (
                          <span key={n2.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                            {n2.profiles?.avatar_url ? (
                              <img src={srcCdn(n2.profiles.avatar_url)} alt={n2.profiles?.display_name ?? ""} title={n2.profiles?.display_name ?? ""} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border-2 border-white object-cover" />
                            ) : (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#f0ece0] text-[11px]">🙂</span>
                            )}
                          </span>
                        ))}
                        {g.items.length > 14 && <span className="ml-1.5 text-[10px] text-[#a09888]">+{g.items.length - 14}</span>}
                      </div>
                      <div className="num mt-0.5 text-[10px] text-[#b0a890]">{relTime(g.at)}</div>
                    </div>
                  </div>
                </Link>
              );
            }
            const n = g.n;
            const unread = !n.read_at;
            const inner = (
              <div
                className="flex items-start gap-2.5 border-b border-[#f0ece0] px-4 py-3"
                style={{ opacity: unread ? 1 : 0.55, background: unread ? "#fffaf0" : "transparent" }}
              >
                {n.profiles?.avatar_url ? (
                  <img src={srcCdn(n.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece0] text-[14px]">🔔</span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] leading-snug text-[#3a3428]"
                    style={{ fontWeight: unread ? 800 : 400 }}
                  >
                    {notifText(n)}
                  </div>
                  {n.excerpt && (
                    <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[#8a8070]">「{n.excerpt}」</div>
                  )}
                  <div className="num mt-0.5 text-[10px] text-[#b0a890]">{relTime(n.created_at)}</div>
                </div>
                {unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#e05040]" />}
              </div>
            );
            return n.target_url ? (
              <Link key={n.id} href={n.target_url} className="block no-underline">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })
        )}
      </div>
    </main>
  );
}


/** ハート通知を投稿ごとに束ねる（他の通知はそのまま順序維持） */
function groupLikes(rows: NotificationRow[]):
  Array<{ kind: "one"; key: string; n: NotificationRow } | { kind: "likes"; key: string; url: string; at: string; items: NotificationRow[] }> {
  const out: Array<{ kind: "one"; key: string; n: NotificationRow } | { kind: "likes"; key: string; url: string; at: string; items: NotificationRow[] }> = [];
  const likeGroup = new Map<string, { kind: "likes"; key: string; url: string; at: string; items: NotificationRow[] }>();
  for (const n of rows) {
    if (n.kind === "like" && n.target_url) {
      let g = likeGroup.get(n.target_url);
      if (!g) {
        g = { kind: "likes", key: "lk-" + n.target_url, url: n.target_url, at: n.created_at, items: [] };
        likeGroup.set(n.target_url, g);
        out.push(g);
      }
      g.items.push(n);
    } else {
      out.push({ kind: "one", key: n.id, n });
    }
  }
  return out;
}
