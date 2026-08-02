"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [schumann, setSchumann] = useState<number | null>(null);

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
    fetch("https://mitsulow.github.io/0Lei/schumann_data.json")
      .then((r) => r.json())
      .then((d) => setSchumann(d?.modes?.F1?.hz ?? null))
      .catch(() => {});
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
      {/* ── 願い叶い手帳（水色ヒーロー・「い」だけ小さく） ── */}
      <div className="py-2 text-center" style={{ background: "linear-gradient(135deg,#eef8fa,#ddf0f5)" }}>
        <span className="text-[19px] font-extrabold tracking-[3px] text-[#1a7a8a]">
          願<span style={{ fontSize: "70%" }}>い</span>叶<span style={{ fontSize: "70%" }}>い</span>手帳
        </span>
      </div>

      {/* ── 日付（ど真ん中・聖点の日は色が差す） ── */}
      <div className="px-5 pb-1 pt-3 text-center" style={{ borderTop: isShishi ? `3px solid ${accent}` : "none" }}>
        <div style={{ fontFamily: MINCHO }}>
          <span className="text-[26px] font-bold tracking-wide text-[#2a2622]">
            {y}年{m}月{d}日<span className="ml-1 text-[19px] text-[#8a8070]">（{dow}）</span>
          </span>
        </div>
        <div className="mt-0.5 text-[11.5px] tracking-[1px] text-[#a09880]">
          {kyurekiLabel(tk)}
          {best?.sekki && (
            <span className="ml-2 font-bold" style={{ color: accent }}>
              {best.sekki[0]}
            </span>
          )}
          {moon.holy && <span className="ml-2 font-bold text-[#c09030]">✦ {moon.holy}</span>}
        </div>
        <div className="num mt-0.5 text-[11px] text-[#b0a68e]">
          {advDays != null && <span>{advDays.toLocaleString()}回目の地球冒険</span>}
          {schumann != null && (
            <span className="ml-2 text-[#3a9a94]">⚡ シューマン共振 {schumann.toFixed(2)}Hz</span>
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
                  ⏳ 次のフシワカレツトキまで{" "}
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

      {/* ── 今日のダイジェスト（左=潮・中=予定・右=月） ── */}
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
        <div className="px-3.5 py-2.5">
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
      </button>
    </section>
  );
}

/* ═══ オービットメニュー — 中心の卵の家（OneSea）の周りを6つのサービスが公転する。
   傾いた軌道面: 手前に来ると大きく明るく、奥へ回ると小さく暗い。
   指でなぞると回り、タップした天体が開く。放っておくとゆっくり自転し続ける ═══ */
export function ServiceDock() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [angle, setAngle] = useState(-Math.PI / 2);
  const angleRef = useRef(-Math.PI / 2);
  const dragging = useRef<{ a0: number; base: number } | null>(null);
  const movedRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); // 指が来たら軌道が開く
  const closeTimer = useRef<number | null>(null);
  const touchWake = () => {
    setOpen(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const touchSleep = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 2200);
  };

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

  /* ゆっくり公転（ドラッグ中は止まる） */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!dragging.current) {
        angleRef.current += dt * 0.12; // 1周 約52秒
        setAngle(angleRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ITEMS: Array<{ href: string; icon: string; label: string; ext?: boolean; talk?: boolean }> = [
    { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM" },
    { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
    { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
    { href: "/cotozute", icon: "/icons/tab-cotozute.png", label: "コトヅテ" },
    { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
    { href: "/line", icon: "💬", label: "TALK", talk: true },
  ];

  const go = (m: (typeof ITEMS)[number]) => {
    if (m.ext) window.location.href = m.href;
    else router.push(m.href);
  };

  const pointerAngle = (cx: number, cy: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.atan2(cy - (r.top + r.height / 2), cx - (r.left + r.width / 2));
  };

  const W = 340; // 論理サイズ（実際はvwに合わせて縮む）
  const H = open ? 212 : 118; // 普段は薄い帯、指が来たら開く
  const RX = open ? 128 : 118;
  const RY = open ? 62 : 26;

  return (
    <div
      className="relative z-[70] select-none overflow-hidden"
      style={{ background: "radial-gradient(120% 140% at 50% 0%, #17384e 0%, #0e1e2e 55%, #0a1420 100%)" }}
    >
      {/* 星屑 */}
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: i % 5 === 0 ? 2 : 1,
              height: i % 5 === 0 ? 2 : 1,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              opacity: 0.3 + ((i * 29) % 60) / 100,
            }}
          />
        ))}
      </div>

      <div
        ref={boxRef}
        className="relative mx-auto touch-none"
        style={{ width: "100%", maxWidth: W, height: H, transition: "height .35s cubic-bezier(0.2,0.8,0.3,1)" }}
        onTouchStart={(e) => {
          touchWake();
          movedRef.current = false;
          dragging.current = { a0: pointerAngle(e.touches[0].clientX, e.touches[0].clientY), base: angleRef.current };
        }}
        onTouchMove={(e) => {
          if (!dragging.current) return;
          movedRef.current = true;
          const a = pointerAngle(e.touches[0].clientX, e.touches[0].clientY);
          angleRef.current = dragging.current.base + (a - dragging.current.a0);
          setAngle(angleRef.current);
        }}
        onTouchEnd={() => {
          dragging.current = null;
          touchSleep();
        }}
        onMouseEnter={touchWake}
        onMouseLeave={touchSleep}
      >
        {/* 軌道の楕円 */}
        <svg key={String(open)} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width={RX * 2 + 44} height={RY * 2 + 44} aria-hidden style={{ transition: "all .35s" }}>
          <ellipse
            cx={RX + 22}
            cy={RY + 22}
            rx={RX}
            ry={RY}
            fill="none"
            stroke="rgba(140,180,220,.22)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        </svg>

        {/* 中心: 卵の家（OneSea） */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
          <img
            src="/icons/tab-home.png"
            alt="OneSea"
            className="mx-auto object-contain"
            style={{ height: open ? 46 : 34, width: open ? 36 : 27, transition: "all .35s", filter: "drop-shadow(0 0 14px rgba(212,185,106,.55))" }}
          />
          <div className="mt-0.5 text-[8px] font-bold tracking-[2px] text-[#d4b96a]/80">OneSea</div>
        </div>

        {/* 公転する6つのサービス */}
        {ITEMS.map((m, i) => {
          const a = angle + (i * Math.PI * 2) / ITEMS.length;
          const x = Math.cos(a) * RX;
          const y = Math.sin(a) * RY;
          const depth = (Math.sin(a) + 1) / 2; // 0=奥 1=手前
          const sc = 0.72 + 0.55 * depth;
          return (
            <button
              key={m.href}
              onClick={() => {
                if (movedRef.current) return;
                go(m);
              }}
              className="absolute left-1/2 top-1/2 text-center"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${sc})`,
                zIndex: Math.round(depth * 9) + 1,
                opacity: 0.55 + 0.45 * depth,
                transition: dragging.current ? "none" : "transform .35s cubic-bezier(0.2,0.8,0.3,1), opacity .2s",
              }}
              aria-label={m.label}
            >
              <span className="relative block">
                {m.icon.startsWith("/") ? (
                  <img
                    src={m.icon}
                    alt=""
                    className="mx-auto h-[44px] w-[44px] rounded-full object-contain"
                    style={{ filter: `drop-shadow(0 0 ${6 + depth * 10}px rgba(140,190,255,${0.25 + depth * 0.3}))` }}
                  />
                ) : (
                  <span className="block text-[36px] leading-[44px]">{m.icon}</span>
                )}
                {m.talk && unread > 0 && (
                  <span
                    className="absolute -right-1 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-0.5 text-[9px] font-bold text-white"
                    style={{ lineHeight: 1 }}
                  >
                    {unread > 99 ? "99" : unread}
                  </span>
                )}
              </span>
              <span
                className="mt-0.5 block whitespace-nowrap text-[9.5px] font-bold text-[#cfe0f0]"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
