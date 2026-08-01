"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PriceBanner } from "@/components/PriceBanner";
import { moonOf, nextMoons, todayKey, YOBI, type MoonEvent } from "@/lib/almanac";

/* eslint-disable @next/next/no-img-element */

/**
 * ツキヨガ — 新サイト（OneSea内・認証共通）。
 * v7（外部版のコピー）は /tsukiyoga-v7/ に残してあり、下のボタンから開ける。
 * 月のデータは almanac.ts（ツキヨガと同じ計算式）から出す。
 */

const MOON_NEON = {
  color: "#f0e0a8",
  textShadow: "0 0 8px rgba(240,220,150,.85), 0 0 22px rgba(220,190,100,.45)",
};

function jstDate(ms: number) {
  const d = new Date(ms + 9 * 3600000);
  return {
    md: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`,
    yobi: YOBI[d.getUTCDay()],
    hm: `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function MoonRow({ ev }: { ev: MoonEvent }) {
  const { md, yobi, hm } = jstDate(ev.time);
  const isNew = ev.type === "new";
  const dday = Math.max(0, Math.ceil((ev.time - Date.now()) / 86400000));
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="text-[26px] leading-none">{isNew ? "🌑" : "🌕"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-[#f0ead0]">
          {isNew ? "新月（つきたち）" : "満月（くまなし）"}
        </div>
        <div className="num text-[11.5px] text-[#a89a78]">
          {md}（{yobi}） {hm} 頃
        </div>
      </div>
      <span className="num flex-shrink-0 text-[11px] font-bold text-[#c8b888]">
        {dday === 0 ? "今日" : `あと${dday}日`}
      </span>
    </div>
  );
}

export default function TsukiyogaPage() {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u: User | null = session?.user ?? null;
      setAvatar((u?.user_metadata?.avatar_url as string) ?? null);
    });
  }, []);

  const key = todayKey();
  const moon = useMemo(() => moonOf(key), [key]);
  const coming = useMemo(() => nextMoons(4), []);
  const nextNew = coming.find((m) => m.type === "new");
  const nextFull = coming.find((m) => m.type === "full");
  const [y, m, d] = key.split("-").map(Number);
  const yobi = YOBI[new Date(y, m - 1, d).getDay()];

  return (
    <main className="pb-24" style={{ background: "linear-gradient(180deg,#0a0c18 0%,#12142a 100%)", minHeight: "100vh" }}>
      {/* ヒーロー（薄い帯） */}
      <header className="relative flex items-center justify-center px-6 py-2" style={{ background: "#0a0c18" }}>
        <div className="flex items-center gap-2">
          <img src="/icons/cel-moon.png" alt="" className="h-6 w-6 object-contain" />
          <span className="text-[17px] font-extrabold tracking-[3px]" style={MOON_NEON}>
            ツキヨガ
          </span>
        </div>
        <Link href="/my" aria-label="マイページ" className="absolute right-3 top-1/2 -translate-y-1/2">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border-2 border-[#f0e0a8]/60 object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f0e0a8]/60 text-base">🌙</span>
          )}
        </Link>
      </header>
      <PriceBanner service="ツキヨガ" price="月額5,000円" color="#f0e0a8" />

      {/* 今日の月 */}
      <section className="card" style={{ background: "linear-gradient(160deg,#141020,#1e1830)", border: "none" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-extrabold tracking-[2px]" style={MOON_NEON}>
            🌙 今日の月
          </span>
          <span className="num text-[10.5px] text-[#7a6a90]">
            {m}月{d}日（{yobi}）
          </span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-[56px] leading-none drop-shadow-[0_0_18px_rgba(240,220,150,.35)]">{moon.emoji}</span>
          <div>
            <div className="num text-[15px] font-extrabold text-[#f0ead0]">
              月齢 {moon.age.toFixed(1)}
            </div>
            <div className="mt-0.5 text-[12px] text-[#a89ac0]">旧暦 {moon.reki}</div>
            {moon.holy && (
              <div className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold text-[#141020]" style={{ background: "linear-gradient(135deg,#f0e0a8,#d8c078)" }}>
                ✨ 今日は「{moon.holy}」
              </div>
            )}
          </div>
        </div>
      </section>

      {/* これからの新月・満月 */}
      <section className="card" style={{ background: "linear-gradient(160deg,#101425,#181c30)", border: "none" }}>
        <span className="text-[13px] font-extrabold tracking-[2px]" style={MOON_NEON}>
          🗓 これからの月
        </span>
        <div className="mt-2.5 space-y-2">
          {nextNew && <MoonRow ev={nextNew} />}
          {nextFull && <MoonRow ev={nextFull} />}
        </div>
      </section>

      {/* 準備中セクション */}
      <section className="card" style={{ background: "linear-gradient(160deg,#141020,#201a2e)", border: "none" }}>
        <span className="text-[13px] font-extrabold tracking-[2px]" style={MOON_NEON}>
          🧘 ツキヨガレッスン
        </span>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#a89ac0]">
          月のリズムに合わせたヨガレッスン。ただいま準備中です。
        </p>
      </section>

      {/* 旧v7への導線 */}
      <div className="px-4 pt-1">
        <a
          href="/tsukiyoga-v7/index.html"
          className="block w-full rounded-2xl border border-[#f0e0a8]/25 bg-white/5 py-3 text-center text-[13px] font-bold text-[#d8cba0] no-underline"
        >
          🌕 ツキヨガ v7（現行版）を開く →
        </a>
      </div>
    </main>
  );
}
