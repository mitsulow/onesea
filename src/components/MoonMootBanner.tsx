"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Moot, upcomingMoots, fetchMootData, toggleRsvp, fetchSettings } from "@/lib/sekai";

/**
 * トップに出す「セカイムラ満月会 / セカイムラ新月会」セクション。
 * 次の会の日付・あと何日・集う人数・参加表明、開催時は Zoom/YouTube 導線。
 */
export function MoonMootBanner() {
  const [me, setMe] = useState<User | null>(null);
  const [moot] = useState<Moot | null>(() => upcomingMoots(1)[0] ?? null);
  const [count, setCount] = useState(0);
  const [mine, setMine] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const load = useCallback(
    async (uid: string | null) => {
      if (!moot) return;
      const r = await fetchMootData([moot.dateKey], uid);
      setCount(r.counts.get(moot.dateKey) ?? 0);
      setMine(r.mine.has(moot.dateKey));
    },
    [moot]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      load(u?.id ?? null);
    });
    fetchSettings().then(setSettings);
  }, [load]);

  if (!moot) return null;
  const isNew = moot.kind === "new";
  const title = isNew ? "セカイムラ新月会" : "セカイムラ満月会";
  const today = moot.dday === 0;

  const rsvp = async () => {
    if (!me) return;
    await toggleRsvp(me.id, moot.dateKey, moot.kind, mine);
    load(me.id);
  };

  return (
    <section
      className="card"
      style={{
        margin: "0 -16px",
        borderRadius: 0,
        border: "none",
        borderBottom: "1px solid #2a4a3a",
        background: "linear-gradient(150deg,#0f1a25,#1a2a38)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[32px] leading-none" style={{ filter: isNew ? "none" : "drop-shadow(0 0 10px rgba(255,240,180,.5))" }}>
          {isNew ? "🌑" : "🌕"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold tracking-[2px] text-[#eae6b8]">{title}</div>
          <div className="num mt-0.5 text-[12px] text-[#a8d8b8]">
            {moot.label} {moot.hour}時〜
            <span className="ml-1.5 font-bold" style={{ color: today ? "#ffd870" : "#7aa88a" }}>
              {today ? "今日！" : moot.dday === 1 ? "明日" : `あと${moot.dday}日`}
            </span>
            <span className="ml-1.5 text-[#5a7a68]">{count}人が集う予定</span>
          </div>
        </div>
        {me && (
          <button
            onClick={rsvp}
            className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-extrabold"
            style={
              mine
                ? { background: "#2a5a3a", color: "#a8d8b8", border: "1px solid #4a9a6a" }
                : { background: "#d4b96a", color: "#1a2432" }
            }
          >
            {mine ? "✓ 集います" : "集います"}
          </button>
        )}
      </div>

      {/* 当日はここから入れる */}
      {today && (settings.zoom_url || settings.youtube_url) && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {settings.zoom_url && (
            <a
              href={settings.zoom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#2d8cff] py-2 text-center text-[12.5px] font-extrabold text-white no-underline"
            >
              Zoom で参加
            </a>
          )}
          {settings.youtube_url && (
            <a
              href={settings.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#f00] py-2 text-center text-[12.5px] font-extrabold text-white no-underline"
            >
              YouTube で視聴
            </a>
          )}
        </div>
      )}

      <Link href="/sekai#moots" className="mt-2 block text-right text-[10.5px] text-[#5a7a68] no-underline">
        この先の集い・壇上ルームへ →
      </Link>
    </section>
  );
}
