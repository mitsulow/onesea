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
      {/* ── 日付（ど真ん中・聖点の日は色が差す） ── */}
      <div className="px-5 pb-1 pt-4 text-center" style={{ borderTop: isShishi ? `3px solid ${accent}` : "none" }}>
        <div style={{ fontFamily: MINCHO }}>
          <span className="text-[26px] font-bold tracking-wide text-[#2a2622]">
            {y}年{m}月{d}日<span className="ml-1 text-[19px] text-[#8a8070]">（{dow}）</span>
          </span>
        </div>
        <div className="mt-1 text-[11px] tracking-[1px] text-[#a09880]">
          {kyurekiLabel(tk)}
          {best?.sekki && (
            <span className="ml-2 font-bold" style={{ color: accent }}>
              {best.sekki[0]}
            </span>
          )}
          {moon.holy && <span className="ml-2 font-bold text-[#c09030]">✦ {moon.holy}</span>}
          {advDays != null && (
            <span className="num ml-2 text-[#b8ae98]">🌏 {advDays.toLocaleString()}日目</span>
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
                  ⏳ {left > 12 * 3600000 ? "明日の" : ""}願い叶いタイム{" "}
                  <span className="num font-bold" style={{ color: accent }}>{target.e.time}</span>
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

/* ═══ サービスDock — 指が来たアイコンだけ、Mac Dockのようにめっちゃ大きくなる ═══ */
export function ServiceDock() {
  const [unread, setUnread] = useState(0);
  const [fx, setFx] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    const supabase = createClient();
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || stop) return;
      const n = await fetchUnreadTotal(uid);
      if (!stop) setUnread(n);
    };
    run();
    const t = setInterval(run, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const ITEMS: Array<{ href: string; icon: string; label: string; ext?: boolean; talk?: boolean; techo?: boolean }> = [
    { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM" },
    { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
    { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
    { href: "/cotozute", icon: "/icons/tab-cotozute.png", label: "コトヅテ" },
    { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
    { href: "/line", icon: "💬", label: "TALK", talk: true },
    { href: "#techo", icon: "📖", label: "手帳", techo: true },
    { href: "/my", icon: "🪪", label: "マイページ" },
  ];

  /* 指の位置からガウス分布で拡大率を出す（本家Dockの物理） */
  const scaleFor = (i: number) => {
    if (fx == null) return 1;
    const r = rowRef.current?.getBoundingClientRect();
    if (!r) return 1;
    const cx = r.left + ((i + 0.5) * r.width) / ITEMS.length;
    const d = Math.abs(fx - cx);
    return 1 + 1.6 * Math.exp(-(d * d) / (2 * 54 * 54)); // 指下は約2.6倍まで膨らむ
  };

  return (
    <div
      ref={rowRef}
      className="flex items-end justify-between px-4 pb-2 pt-3"
      style={{ touchAction: "pan-y", background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      onTouchStart={(e) => setFx(e.touches[0].clientX)}
      onTouchMove={(e) => setFx(e.touches[0].clientX)}
      onTouchEnd={() => setTimeout(() => setFx(null), 120)}
      onMouseMove={(e) => setFx(e.clientX)}
      onMouseLeave={() => setFx(null)}
    >
      {ITEMS.map((m, i) => {
        const sc = scaleFor(i);
        const big = sc > 1.6;
        const inner = (
          <span
            className="relative block"
            style={{
              transform: `translateY(${-(sc - 1) * 13}px) scale(${sc})`,
              transformOrigin: "bottom center",
              transition: fx != null ? "transform 60ms linear" : "transform 260ms cubic-bezier(0.2,0.8,0.3,1)",
            }}
          >
            {/* 拡大中だけ名前が浮かぶ */}
            {big && (
              <span
                className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[8.5px] font-bold text-[#17384e]"
                style={{ transform: `translateX(-50%) scale(${1 / sc})`, transformOrigin: "bottom center" }}
              >
                {m.label}
              </span>
            )}
            {m.icon.startsWith("/") ? (
              <img src={m.icon} alt={m.label} className="h-[34px] w-[34px] rounded-full object-contain" />
            ) : (
              <span className="block text-[28px] leading-[34px]">{m.icon}</span>
            )}
            {m.talk && unread > 0 && (
              <span
                className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#e05040] px-0.5 text-[8.5px] font-bold text-white"
                style={{ lineHeight: 1 }}
              >
                {unread > 99 ? "99" : unread}
              </span>
            )}
          </span>
        );
        if (m.techo) {
          return (
            <button key={m.href} onClick={() => window.dispatchEvent(new Event("onesea:openToday"))} aria-label={m.label}>
              {inner}
            </button>
          );
        }
        return m.ext ? (
          <a key={m.href} href={m.href} aria-label={m.label}>
            {inner}
          </a>
        ) : (
          <Link key={m.href} href={m.href} aria-label={m.label}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
