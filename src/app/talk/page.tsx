"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { BroadcastSummary, ChatSummary, GroupSummary, fetchBroadcastSummary, fetchChats, fetchGroups } from "@/lib/line";
import { enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** LINE — トーク一覧（相手・最新メッセージ・未読数） */
export default function LinePage() {
  const [me, setMe] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [tab, setTab] = useState<"dm" | "group">("dm");
  const [showBell, setShowBell] = useState(false);
  const [bellBusy, setBellBusy] = useState(false);
  const [bc, setBc] = useState<BroadcastSummary | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setReady(true);
      if (u) {
        fetchChats(u.id).then(setChats);
        fetchGroups(u.id).then(setGroups);
        fetchBroadcastSummary(u.id).then(setBc).catch(() => {});
        if (pushSupported()) setShowBell(!(await pushEnabled()));
      }
    });
  }, []);

  const turnOnBell = async () => {
    if (!me || bellBusy) return;
    setBellBusy(true);
    const r = await enablePush(me.id);
    setBellBusy(false);
    if (r === "ok") setShowBell(false);
    else if (r === "denied")
      alert("通知がブロックされています。端末の設定 > 通知 からOneSeaを許可してください。");
  };

  // 30秒ごとに更新
  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => {
      fetchChats(me.id).then(setChats);
      fetchGroups(me.id).then(setGroups);
      fetchBroadcastSummary(me.id).then(setBc).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [me]);

  const dmUnread = (chats ?? []).reduce((s, c) => s + c.unread, 0);
  const groupUnread = (groups ?? []).reduce((s, g) => s + g.unread, 0);

  const q = query.trim().toLowerCase();

  /* ★メッセージ本文検索: 名前だけでなく、過去のトーク本文からも探す（300msデバウンス） */
  const [hits, setHits] = useState<Record<string, string>>({});
  useEffect(() => {
    const qq = query.trim();
    if (!qq || !me) { setHits({}); return; }
    const t = setTimeout(async () => {
      const supabase = createClient();
      const esc = qq.replace(/[%_]/g, "\\$&");
      const [dm, gm] = await Promise.all([
        supabase.from("messages").select("chat_id, body").ilike("body", `%${esc}%`).order("created_at", { ascending: false }).limit(60),
        supabase.from("group_messages").select("scope_type, scope_id, body").ilike("body", `%${esc}%`).order("created_at", { ascending: false }).limit(60),
      ]);
      const h: Record<string, string> = {};
      for (const r of (dm.data ?? []) as Array<{ chat_id: string; body: string }>) if (!h[r.chat_id]) h[r.chat_id] = r.body;
      for (const r of (gm.data ?? []) as Array<{ scope_type: string; scope_id: string; body: string }>) {
        const k = `${r.scope_type}:${r.scope_id}`;
        if (!h[k]) h[k] = r.body;
      }
      setHits(h);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, me]);

  const shownChats = (chats ?? []).filter(
    (c) => !q || (c.partner.display_name ?? "").toLowerCase().includes(q) || hits[c.id]
  );
  const shownGroups = (groups ?? []).filter((g) => !q || g.name.toLowerCase().includes(q) || hits[g.key]);

  return (
    <main className="pb-20">
      <TopTone color="#06C755" />
      {/* 統一規格ヘッダー: 高さ52px・サービス名・アバター右 / TALKのイメージカラー=緑 */}
      <header
        className="relative flex h-[52px] items-center justify-start px-4"
        style={{ background: "#06C755" }}
      >
        <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-[4px] text-white">
          <img src="/icons/icon-chat.webp" alt="" className="h-6 w-6 object-contain" />
          TaLK
        </h1>
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <AvatarMenu ring="#7dd8a0" />
        </span>
      </header>

      {me && showBell && (
        <button
          onClick={turnOnBell}
          disabled={bellBusy}
          className="flex w-full items-center gap-2.5 border-b border-[#e8e0d0] bg-[#fdf8ec] px-4 py-2.5 text-left"
        >
          <img src="/icons/icon-bell.webp" alt="" style={{ width: 22, height: 22 }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold text-[#8a6a20]">
              {bellBusy ? "設定中..." : "新着の通知と、アイコンの未読バッジをオンにする"}
            </span>
            <span className="block text-[10px] text-[#b0a070]">
              ホーム画面に追加したOneSeaのアイコンに「③」が出ます（iPhoneはiOS 16.4以降）
            </span>
          </span>
          <span className="flex-shrink-0 rounded-lg bg-[#c8a030] px-3 py-1.5 text-[11.5px] font-extrabold text-white">
            オンにする
          </span>
        </button>
      )}

      {/* 個人 / グループ タブ */}
      {me && (
        <div className="grid grid-cols-2 border-b border-[#e8e0d0] bg-[#fffdf8]">
          {(
            [
              ["dm", "👤 個人TaLK", dmUnread],
              ["group", "👥 グループTaLK", groupUnread],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-extrabold"
              style={{ color: tab === id ? "#c94d3a" : "#a09888" }}
            >
              {label}
              {n > 0 && (
                <span
                  className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {n > 99 ? "99+" : n}
                </span>
              )}
              {tab === id && <span className="absolute bottom-0 left-1/2 h-[3px] w-14 -translate-x-1/2 rounded-t-full bg-[#c94d3a]" />}
            </button>
          ))}
        </div>
      )}

      {/* 検索（LINE風） */}
      {me && (
        <div className="border-b border-[#f0e9dc] bg-[#fffdf8] px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#f0ead9] px-3 py-1.5">
            <img src="/icons/icon-search.webp" alt="" style={{ width: 16, height: 16 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索"
              className="w-full bg-transparent text-[13.5px] text-[#3a3428] outline-none placeholder:text-[#b8b0a0]"
            />
          </div>
        </div>
      )}

      {/* 📢 事務局からのお知らせ（最上部ピン留め） */}
      {me && !q && (
        <Link
          href="/talk/broadcast"
          className="flex items-center gap-3 border-b border-[#e8dcc4] bg-[#fffbef] px-4 py-3 no-underline active:bg-[#faf4e0]"
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px]"
            style={{ background: "linear-gradient(140deg,#17384e,#0e1e2e)" }}
          >
            <img src="/icons/icon-megaphone.webp" alt="" style={{ width: 26, height: 26 }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[14.5px] font-bold text-[#3a3428]">
                事務局からのお知らせ
                <span className="ml-1.5 rounded bg-[#d4b96a] px-1 py-0.5 text-[8.5px] font-extrabold text-white align-middle">公式</span>
              </span>
              <span className="num flex-shrink-0 text-[10.5px] text-[#c0b8a8]">{timeLabel(bc?.lastAt ?? null)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="line-clamp-2 text-[12.5px] leading-snug text-[#a09888]">
                {bc?.lastBody ?? "OneSeaからの大切なお知らせが届きます"}
              </span>
              {(bc?.unread ?? 0) > 0 && (
                <span
                  className="flex h-[19px] min-w-[19px] flex-shrink-0 items-center justify-center rounded-full bg-[#e05040] px-1.5 text-[10px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {(bc?.unread ?? 0) > 99 ? "99+" : bc?.unread}
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {!ready ? null : !me ? (
        <p className="px-5 py-10 text-center text-sm text-[#8a8070]">
          <Link href="/" className="text-[#c94d3a] underline">
            ログイン
          </Link>
          するとメッセージが使えます
        </p>
      ) : tab === "group" ? (
        groups === null ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-3 text-sm leading-relaxed text-[#8a8070]">
              まだグループがありません。
              <br />
              セカイムラの村や部活に入ると、
              <br />
              そのグループトークがここに並びます。
            </p>
            <Link
              href="/sekai/villages"
              className="mt-4 inline-block rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-white no-underline"
              style={{ background: "#4a8a5c" }}
            >
              🏡 村をさがす
            </Link>
          </div>
        ) : (
          <div>
            {shownGroups.map((g) => (
              <Link
                key={g.key}
                href={`/talk/g/${g.type}/${g.id}`}
                className="flex items-center gap-3 border-b border-[#f0e9dc] bg-[#fffdf8] px-4 py-3 no-underline active:bg-[#faf4ea]"
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[22px]"
                  style={{ background: "linear-gradient(140deg,#d8e8cf,#a8cca8)" }}
                >
                  {g.emoji === "🧠" ? <img src="/icons/icon-neura5.webp" alt="" style={{ width: 22, height: 22 }} /> : g.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14.5px] font-bold text-[#3a3428]">
                      {g.name}
                      {g.count > 0 && <span className="num ml-1 font-medium text-[#a09888]">({g.count})</span>}
                    </span>
                    <span className="num flex-shrink-0 text-[10.5px] text-[#c0b8a8]">{timeLabel(g.lastAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-[#a09888]">
                      {q && hits[g.key] ? <>🔍 {hits[g.key]}</> : (g.lastBody ?? "みんなに、ひとこと目をどうぞ")}
                    </span>
                    {g.unread > 0 && (
                      <span
                        className="flex h-[19px] min-w-[19px] flex-shrink-0 items-center justify-center rounded-full bg-[#e05040] px-1.5 text-[10px] font-bold text-white"
                        style={{ lineHeight: 1 }}
                      >
                        {g.unread > 99 ? "99+" : g.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : chats === null ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
        </div>
      ) : chats.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-4xl">💬</div>
          <p className="mt-3 text-sm leading-relaxed text-[#8a8070]">
            まだトークがありません。
            <br />
            むらびとのマイページの「連絡を取る」から始まります。
          </p>
        </div>
      ) : (
        <div>
          {shownChats.map((c) => (
            <Link
              key={c.id}
              href={`/talk/${c.id}`}
              className="flex items-center gap-3 border-b border-[#f0e9dc] bg-[#fffdf8] px-4 py-3 no-underline active:bg-[#faf4ea]"
            >
              <div className="relative flex-shrink-0">
                {c.partner.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.partner.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                  >
                    🌿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14.5px] font-bold text-[#3a3428]">
                    {c.partner.display_name ?? "むらびと"}
                  </span>
                  <span className="num flex-shrink-0 text-[10.5px] text-[#c0b8a8]">
                    {timeLabel(c.lastAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-2 text-[12.5px] leading-snug text-[#a09888]">
                    {q && hits[c.id] ? <>🔍 {hits[c.id]}</> : (c.lastBody ?? "トークを始めましょう")}
                  </span>
                  {c.unread > 0 && (
                    <span
                      className="flex h-[19px] min-w-[19px] flex-shrink-0 items-center justify-center rounded-full bg-[#e05040] px-1.5 text-[10px] font-bold text-white"
                      style={{ lineHeight: 1 }}
                    >
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
