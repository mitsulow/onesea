"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  bestOfComputed,
  eventsOfComputed,
  moonOf,
  moonImageOf,
  moonTimesOf,
  kyurekiLabel,
  todayKey,
  keyOf,
  YOBI,
  SHISHI_COLOR,
} from "@/lib/almanac";
import { TideDay, fetchTideDay } from "@/lib/tide";
import { fetchUnreadTotal } from "@/lib/line";

/* eslint-disable @next/next/no-img-element */

/**
 * OneSeaトップの「今日が届く」ダッシュボード。
 * 日付（明朝体・特大）→ 願い叶いタイムのカウントダウン → 今日のダイジェスト（潮・月・予定）。
 * 数字はすべて天文計算・実データ。装飾は余白と罫線で作る（カード連打のAI面は避ける）。
 */

const MINCHO = '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function HomeDashboard() {
  const now0 = new Date();
  const tk = todayKey(now0);
  const [y, m, d] = tk.split("-").map(Number);
  const dow = YOBI[new Date(y, m - 1, d).getDay()];

  const best = bestOfComputed(tk);
  const isShishi = best && [0, 90, 180, 270].includes(best.deg);
  const accent = isShishi ? SHISHI_COLOR[best!.deg] : "#8b6914";

  const moon = useMemo(() => moonOf(tk), [tk]);
  const [tide, setTide] = useState<TideDay | null>(null);
  const [advDays, setAdvDays] = useState<number | null>(null);

  /* 次の節分かれつ刻（今日の残り→無ければ明日）へのカウントダウン */
  const target = useMemo(() => {
    const mk = (key: string, time: string) => {
      const [yy, mm, dd] = key.split("-").map(Number);
      const [hh, mi] = time.split(":").map(Number);
      return new Date(yy, mm - 1, dd, hh, mi).getTime();
    };
    const today = eventsOfComputed(tk).map((e) => ({ t: mk(tk, e.time), e }));
    const future = today.filter((x) => x.t > Date.now());
    if (future.length) return future[0];
    const nd = new Date(y, m - 1, d + 1);
    const nk = keyOf(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
    const tomorrow = eventsOfComputed(nk).map((e) => ({ t: mk(nk, e.time), e }));
    return tomorrow[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tk]);

  const [left, setLeft] = useState<number>(target ? target.t - Date.now() : 0);
  useEffect(() => {
    const t = setInterval(() => setLeft(target ? target.t - Date.now() : 0), 1000);
    return () => clearInterval(t);
  }, [target]);

  const mt = useMemo(() => {
    try {
      const pos = JSON.parse(localStorage.getItem("onesea-pos") ?? "null");
      return moonTimesOf(tk, pos?.lat ?? 35.68, pos?.lon ?? 139.76);
    } catch {
      return moonTimesOf(tk);
    }
  }, [tk]);

  /* 今日の予定（手帳から） */
  const [plans, setPlans] = useState<Array<{ time: string; text: string; color?: string }>>([]);
  useEffect(() => {
    fetchTideDay(tk).then(setTide);
    try {
      const memos = JSON.parse(localStorage.getItem("techo-memos") ?? "{}");
      const day = memos[tk];
      const list: Array<{ time: string; text: string; color?: string }> = [];
      for (const ev of day?.ev ?? []) {
        list.push({ time: `${pad(ev.sh)}:${pad(ev.sm)}`, text: ev.text, color: ev.color });
      }
      for (const [h, v] of Object.entries(day?.h ?? {})) {
        for (const line of String(v).split("\n")) {
          if (line.trim()) list.push({ time: `${pad(Number(h))}:00`, text: line.trim() });
        }
      }
      list.sort((a, b) => a.time.localeCompare(b.time));
      setPlans(list.slice(0, 4));
    } catch {}
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("birthday").eq("id", uid).maybeSingle();
      if (prof?.birthday) {
        setAdvDays(Math.floor((Date.now() - new Date(prof.birthday + "T00:00:00+09:00").getTime()) / 86400000) + 1);
      }
    });
  }, [tk]);

  const openToday = () => window.dispatchEvent(new Event("onesea:openToday"));

  const hrs = Math.floor(Math.max(0, left) / 3600000);
  const mins = Math.floor((Math.max(0, left) % 3600000) / 60000);
  const secs = Math.floor((Math.max(0, left) % 60000) / 1000);
  const isNow = left <= 0 && left > -10 * 60000; // 刻の10分間は「いま」

  const tideRows = useMemo(() => {
    const rows: Array<[string, string]> = [];
    if (tide) {
      for (const [t] of tide.high) rows.push(["満", t]);
      for (const [t] of tide.low) rows.push(["干", t]);
      rows.sort((a, b) => a[1].localeCompare(b[1]));
    }
    return rows;
  }, [tide]);

  return (
    <section className="bg-white" style={{ margin: "0 -16px" }}>
      {/* ── 日付（聖点の日は色が差す） ── */}
      <div className="px-5 pb-1 pt-4" style={{ borderTop: isShishi ? `3px solid ${accent}` : "none" }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2" style={{ fontFamily: MINCHO }}>
              <span className="text-[40px] font-bold leading-none tracking-tight text-[#2a2622]">
                {m}<span className="mx-0.5 text-[22px] text-[#b0a890]">/</span>{d}
              </span>
              <span className="text-[16px] text-[#8a8070]">{dow}曜日</span>
            </div>
            <div className="mt-1 text-[11px] tracking-[1px] text-[#a09880]">
              {kyurekiLabel(tk)}
              {best?.sekki && (
                <span className="ml-2 font-bold" style={{ color: accent }}>
                  {best.sekki[0]}
                </span>
              )}
              {moon.holy && <span className="ml-2 font-bold text-[#c09030]">✦ {moon.holy}</span>}
            </div>
          </div>
          {advDays != null && (
            <div className="pb-1 text-right">
              <div className="num text-[10px] leading-tight text-[#b8ae98]">地球冒険</div>
              <div className="num text-[13px] font-bold leading-tight text-[#8a7a5a]">
                {advDays.toLocaleString()}<span className="text-[9px]">日目</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 願い叶いタイム カウントダウン ── */}
      {target && (
        <Link href={isNow ? "/mmm/ddp" : "/#techo"} className="no-underline" onClick={(e) => {
          if (!isNow) {
            e.preventDefault();
            openToday();
          }
        }}>
          <div
            className="mx-5 mt-2 rounded-lg px-4 py-2.5"
            style={
              isNow
                ? { background: "linear-gradient(120deg,#3a2c08,#6a5010)", boxShadow: "0 0 24px rgba(212,185,106,.5)" }
                : { background: "#faf7f0", border: "1px solid #eee6d4" }
            }
          >
            {isNow ? (
              <div className="text-center">
                <div className="text-[11px] tracking-[3px] text-[#e8cc80]">フシワカレツトキ</div>
                <div className="text-[15px] font-bold text-[#f6e9c4]" style={{ fontFamily: MINCHO }}>
                  いま、願いを書き換える時 →
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-[10.5px] tracking-[2px] text-[#a09070]">
                  ⏳ 願い叶いタイム <span className="num font-bold" style={{ color: accent }}>{target.e.time}</span>
                </span>
                <span className="num text-[13px] text-[#6a5a3a]" style={{ fontFamily: MINCHO }}>
                  あと {hrs > 0 && <b>{hrs}<span className="text-[10px]">時間</span></b>}
                  <b>{mins}<span className="text-[10px]">分</span></b>
                  <b>{secs}<span className="text-[10px]">秒</span></b>
                </span>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* ── 今日のダイジェスト（罫線3列） ── */}
      <button onClick={openToday} className="mt-3 grid w-full grid-cols-3 border-y border-[#efe9dc] text-left">
        <div className="border-r border-[#efe9dc] px-3.5 py-2.5">
          <div className="text-[9px] tracking-[2px] text-[#8ea8c0]">潮 {tide ? `・${tide.port}` : ""}</div>
          <div className="mt-1 space-y-[3px]">
            {tideRows.length ? (
              tideRows.map(([lb, t], i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span style={{ color: lb === "満" ? "#3070b0" : "#88aac8", fontWeight: lb === "満" ? 700 : 400 }}>{lb}</span>
                  <span className="num text-[#4a4438]">{t}</span>
                </div>
              ))
            ) : (
              <div className="text-[10px] text-[#c0b8a8]">—</div>
            )}
          </div>
        </div>
        <div className="border-r border-[#efe9dc] px-3.5 py-2.5">
          <div className="text-[9px] tracking-[2px] text-[#a89860]">月</div>
          <div className="mt-1 flex items-center gap-2">
            <img src={moonImageOf(moon.age)} alt="" className="h-8 w-8" loading="lazy" />
            <div className="num text-[10.5px] leading-snug text-[#6a604a]">
              <div>月齢 {moon.age.toFixed(1)}</div>
            </div>
          </div>
          <div className="mt-1 space-y-[2px] text-[10px] text-[#8a8068]">
            <div className="flex justify-between"><span>出</span><span className="num">{mt.rise ?? "—"}</span></div>
            <div className="flex justify-between"><span>入</span><span className="num">{mt.set ?? "—"}</span></div>
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="text-[9px] tracking-[2px] text-[#7ba05b]">予定</div>
          <div className="mt-1 space-y-[3px]">
            {plans.length ? (
              plans.map((p, i) => (
                <div key={i} className="flex items-baseline gap-1.5 text-[11px]">
                  <span className="num flex-shrink-0 text-[9.5px] text-[#a09880]">{p.time}</span>
                  <span className="truncate text-[#4a4438]">{p.text}</span>
                </div>
              ))
            ) : (
              <div className="text-[10px] leading-relaxed text-[#c0b8a8]">まだ予定なし<br />タップして書く</div>
            )}
          </div>
        </div>
      </button>
    </section>
  );
}

/* ═══ 9つのメインメニュー — 夜の星座盤（常時点灯） ═══ */
export function NineGrid() {
  const [unread, setUnread] = useState(0);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    const supabase = createClient();
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || stopRef.current) return;
      const n = await fetchUnreadTotal(uid);
      if (!stopRef.current) setUnread(n);
    };
    run();
    const t = setInterval(run, 30000);
    return () => {
      stopRef.current = true;
      clearInterval(t);
    };
  }, []);

  const cell =
    "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 no-underline transition-transform active:scale-95";
  const label = (t: string) => (
    <span className="text-[10.5px] font-bold tracking-[1px] text-[#c8d2e4]">{t}</span>
  );
  const glow = { filter: "drop-shadow(0 0 8px rgba(140,180,255,.35))" };

  return (
    <section
      className="px-4 pb-8 pt-5"
      style={{ margin: "0 -16px", background: "linear-gradient(180deg,#0b1120 0%,#101830 60%,#0b1120 100%)" }}
    >
      <div className="mb-3 text-center text-[9.5px] tracking-[4px] text-[#5a6a8a]">ONESEA — すべての海は、ひとつ。</div>
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/mmm" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <img src="/icons/cel-sun.png" alt="" className="h-10 w-10 object-contain" style={glow} />
          {label("MMM")}
        </Link>
        <Link href="/sekai" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <img src="/icons/cel-earth.png" alt="" className="h-10 w-10 object-contain" style={glow} />
          {label("セカイムラ")}
        </Link>
        <a href="/tsukiyoga-v7/index.html" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <img src="/icons/cel-moon.png" alt="" className="h-10 w-10 object-contain" style={glow} />
          {label("ツキヨガ")}
        </a>

        <Link href="/cotozute" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <img src="/icons/tab-cotozute.png" alt="" className="h-10 w-10 object-contain" style={glow} />
          {label("コトヅテ")}
        </Link>
        <div className={cell} style={{ background: "rgba(212,185,106,.10)", border: "1px solid rgba(212,185,106,.35)" }}>
          <img src="/icons/tab-home.png" alt="" className="h-10 w-8 object-contain" style={{ filter: "drop-shadow(0 0 10px rgba(212,185,106,.5))" }} />
          <span className="text-[10.5px] font-bold tracking-[1px] text-[#e8d8a8]">HOME</span>
        </div>
        <Link href="/za" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <img src="/rakuichi/logo-emblem.webp" alt="" className="h-10 w-10 rounded-full object-cover" style={glow} />
          {label("楽市楽座")}
        </Link>

        <a
          href="/#techo"
          className={cell}
          style={{ background: "rgba(255,255,255,.045)" }}
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(new Event("onesea:openToday"));
          }}
        >
          <span className="text-[32px] leading-none" style={glow}>📖</span>
          {label("手帳")}
        </a>
        <Link href="/my" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <span className="text-[32px] leading-none" style={glow}>🪪</span>
          {label("マイページ")}
        </Link>
        <Link href="/line" className={cell} style={{ background: "rgba(255,255,255,.045)" }}>
          <span className="relative text-[32px] leading-none" style={glow}>
            💬
            {unread > 0 && (
              <span
                className="absolute -right-3 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[10px] font-bold text-white"
                style={{ lineHeight: 1 }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {label("TALK")}
        </Link>
      </div>
    </section>
  );
}
