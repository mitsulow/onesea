"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 朝いちのオープニング（約18秒・タップでスキップ）。
 * 宇宙 → 天の川銀河（日付・ドセンター） → らせん太陽系（djsadhu風）
 * → カメラが太陽系ごと3番目の惑星へクローズアップ → NASA画像へゆっくりクロスフェード
 * → キリの中から OTOHIKARI の地球儀が現れて着地。
 * 「今日の地球を、どう楽しむ？」だけ着地後も約2秒フェードで残る。
 * すべて rAF の同一時計で制御（機種非依存）。地球のみ NASA 実画像。
 */

const TOTAL = 18000; // 宇宙〜OTOHIKARI着地
const LINGER = 20500; // 「今日の地球を…」だけ着地後も約2秒残す

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function span(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

export function MorningOpening() {
  const [show, setShow] = useState(false);
  const [dateLine, setDateLine] = useState("");
  const [advLines, setAdvLines] = useState<[string, string, string]>(["", "", ""]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<HTMLImageElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const text1Ref = useRef<HTMLDivElement>(null);
  const adv0Ref = useRef<HTMLDivElement>(null);
  const adv1Ref = useRef<HTMLDivElement>(null);
  const adv2Ref = useRef<HTMLDivElement>(null);
  const text3Ref = useRef<HTMLDivElement>(null);
  const [earthCenterY, setEarthCenterY] = useState(260);

  useEffect(() => {
    const today = new Date();
    // チェック期間中はリロードのたびに毎回表示。
    // 本番運用に戻すときは下のコメントを解除（その日最初の1回だけになる）
    // const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    // try {
    //   if (localStorage.getItem("onesea-morning-shown") === key) return;
    //   localStorage.setItem("onesea-morning-shown", key);
    // } catch {}

    const yobi = ["日", "月", "火", "水", "木", "金", "土"][today.getDay()];
    setDateLine(`${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${yobi}）`);
    setAdvLines(["", "今日も", "地球冒険の日"]);
    setShow(true);

    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user;
      if (!u) return;
      const [{ data: prof }, { data: priv }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", u.id).maybeSingle(),
        supabase.from("private_profiles").select("birth_date").eq("user_id", u.id).maybeSingle(),
      ]);
      const name = prof?.display_name ?? "";
      const d0 = new Date();
      d0.setHours(0, 0, 0, 0);
      if (priv?.birth_date) {
        const days = Math.floor((d0.getTime() - new Date(priv.birth_date + "T00:00:00").getTime()) / 86400000) + 1;
        setAdvLines([`${name}隊員`, `${days.toLocaleString()}回目となる`, "地球冒険の日"]);
      } else if (name) {
        setAdvLines([`${name}隊員`, "今日もまた", "地球冒険の日"]);
      }
    });
  }, []);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    const earth = earthRef.current;
    const root = rootRef.current;
    if (!canvas || !earth || !root) return;

    document.body.style.overflow = "hidden";
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext("2d")!;
    g.scale(dpr, dpr);

    /* 着地点: OTOHIKARI の地球儀 */
    let tx = W / 2;
    let ty = Math.min(H * 0.42, 320);
    let tr = Math.min(W, 360) * 0.5;
    const globeEl = document.getElementById("otohikari-globe");
    if (globeEl) {
      const r = globeEl.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
      tr = r.height * 0.507; // OTOHIKARI の球より2割大きく重ねて没入感を出す
    }
    setEarthCenterY(ty);

    /* 星 */
    const stars = Array.from({ length: 240 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
      s: 0.4 + Math.random() * 1.3,
      tw: Math.random() * Math.PI * 2,
    }));

    /* 天の川 */
    const gal = Array.from({ length: 1500 }, () => ({
      along: (Math.random() - 0.5) * 2,
      spread: (Math.random() + Math.random() + Math.random() - 1.5) / 1.5,
      bright: Math.random(),
      tw: Math.random() * Math.PI * 2,
    }));

    /* らせん太陽系（djsadhu 風） */
    const AXIS = -0.1;
    const dirX = -Math.cos(AXIS);
    const dirY = -Math.sin(AXIS); // 右→左へ進む
    const perpX = -dirY;
    const perpY = dirX;
    const SOL_T0 = 6700;
    const SOL_T1 = 13900;
    const helixPlanets = [
      { r: 13, period: 900, phase: 0.0, color: "160,200,255", size: 1.7 },
      { r: 19, period: 1300, phase: 2.1, color: "255,214,150", size: 2.2 },
      { r: 26, period: 1750, phase: 4.2, color: "110,190,255", size: 2.6 },
      { r: 33, period: 2300, phase: 1.2, color: "255,150,110", size: 2.0 },
      { r: 44, period: 3200, phase: 3.4, color: "235,205,160", size: 3.6 },
      { r: 54, period: 4200, phase: 5.5, color: "210,225,255", size: 3.1 },
    ];
    const sunPos = (tau: number) => {
      const p = span(tau, SOL_T0, SOL_T1);
      const travel = W * 0.62 * p;
      return {
        x: W * 0.82 + dirX * travel,
        y: H * 0.4 + dirY * travel + Math.sin(p * Math.PI) * 6,
      };
    };

    const start = performance.now();
    let raf = 0;
    let released = false;

    const draw = (now: number) => {
      const t = now - start;
      if (doneRef.current) return;
      g.clearRect(0, 0, W, H);

      /* ---- フェーズ ---- */
      const starIn = span(t, 0, 1400);
      const galIn = span(t, 1000, 3100) * (1 - span(t, 6200, 7900) * 0.82);
      const galZoom = 1 + easeInOut(span(t, 2200, 7900)) * 2.4;
      /* カメラ: らせん太陽系ごと 3番目の惑星（地球）へクローズアップしていく */
      const camT = easeInOut(span(t, 12200, 15400));
      const fPl = helixPlanets[2];
      const fBase = sunPos(t);
      const fTh = (t / fPl.period) * Math.PI * 2 + fPl.phase;
      const fOff = Math.sin(fTh) * fPl.r;
      const fDep = Math.cos(fTh);
      const fx = fBase.x + perpX * fOff + dirX * fDep * fPl.r * 0.22;
      const fy = fBase.y + perpY * fOff + dirY * fDep * fPl.r * 0.22;
      const camZ = 1 + camT * 12;
      const panX = (tx - fx) * camT;
      const panY = (ty - fy) * camT;
      const solIn = span(t, 6700, 8300) * (1 - span(t, 13800, 15000));
      const allOut = span(t, 16300, TOTAL);
      const cosmicAlpha = (1 - allOut) * 0.98;

      /* ---- テキスト（同一時計・機種非依存） ---- */
      const textAnim = (
        el: HTMLDivElement | null,
        inA: number,
        inB: number,
        outA: number,
        outB: number,
        centerV = false
      ) => {
        if (!el) return;
        const ein = easeInOut(span(t, inA, inB));
        const eout = span(t, outA, outB);
        el.style.opacity = String(ein * (1 - eout));
        const rise = (1 - ein) * 24;
        el.style.transform = centerV
          ? `translate(-50%, calc(-50% + ${rise}px)) scale(${1.04 - ein * 0.04})`
          : `translate(-50%, ${rise}px) scale(${1.04 - ein * 0.04})`;
      };
      textAnim(text1Ref.current, 2400, 3800, 5900, 7000, true); // 日付ドセンター
      textAnim(adv0Ref.current, 7900, 9000, 12100, 13100); // ◯◯隊員
      textAnim(adv1Ref.current, 9000, 10100, 12100, 13100); // N回目となる
      textAnim(adv2Ref.current, 10100, 11200, 12100, 13100); // 地球冒険の日
      textAnim(text3Ref.current, 14800, 15900, 19300, 20400, true); // 地球の中心・着地後も残る

      /* ---- 星 ---- */
      g.globalAlpha = starIn * cosmicAlpha;
      for (const s of stars) {
        const par = 1 + (galZoom - 1) * s.z * 0.35;
        const x = tx + (s.x - tx) * par;
        const y = ty + (s.y - ty) * par;
        const twinkle = 0.6 + 0.4 * Math.sin(t / 500 + s.tw);
        g.fillStyle = `rgba(255,255,255,${0.5 * twinkle})`;
        g.fillRect(x, y, s.s, s.s);
      }
      g.globalAlpha = 1;

      /* ---- 天の川 ---- */
      if (galIn > 0.01) {
        g.save();
        g.translate(W / 2, H * 0.42);
        g.rotate(-0.42);
        g.scale(galZoom, galZoom);
        const bandLen = W * 0.62;
        const bandWid = W * 0.16;
        const halo = g.createRadialGradient(0, 0, 0, 0, 0, bandLen * 0.75);
        halo.addColorStop(0, `rgba(255,246,224,${0.3 * galIn * cosmicAlpha})`);
        halo.addColorStop(0.35, `rgba(180,190,235,${0.16 * galIn * cosmicAlpha})`);
        halo.addColorStop(1, "rgba(140,150,220,0)");
        g.fillStyle = halo;
        g.save();
        g.scale(1, bandWid / (bandLen * 0.75));
        g.beginPath();
        g.arc(0, 0, bandLen * 0.75, 0, Math.PI * 2);
        g.fill();
        g.restore();
        for (const p of gal) {
          const x = p.along * bandLen;
          const y = p.spread * bandWid * (1 - Math.abs(p.along) * 0.45);
          const core = 1 - Math.min(1, (Math.abs(p.along) * 1.2 + Math.abs(p.spread)) * 0.85);
          const twinkle = 0.7 + 0.3 * Math.sin(t / 700 + p.tw);
          const a = galIn * cosmicAlpha * (0.14 + p.bright * 0.5 + core * 0.35) * twinkle;
          g.fillStyle =
            p.bright > 0.86
              ? `rgba(255,240,214,${a})`
              : p.bright > 0.5
                ? `rgba(235,238,255,${a * 0.9})`
                : `rgba(170,180,235,${a * 0.75})`;
          const sz = (p.bright > 0.86 ? 1.6 : 1) / galZoom + 0.3;
          g.fillRect(x, y, sz, sz);
        }
        g.restore();
      }

      /* ---- らせん太陽系（金の尾の太陽 + らせんの惑星たち） ---- */
      if (solIn > 0.01) {
        const sun = sunPos(t);
        /* カメラ変換: 3番目の惑星を固定点に、太陽系全体を拡大しながら着地点へパン */
        g.save();
        g.translate(fx + panX, fy + panY);
        g.scale(camZ, camZ);
        g.translate(-fx, -fy);

        const TAIL = 2600;
        g.lineWidth = 2.2 / camZ;
        for (let s0 = TAIL; s0 > 0; s0 -= 90) {
          const a = sunPos(t - s0);
          const b = sunPos(t - s0 + 90);
          const k = 1 - s0 / TAIL;
          g.strokeStyle = `rgba(255,210,110,${0.38 * k * solIn * cosmicAlpha})`;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }

        for (const pl of helixPlanets) {
          const TRAIL = pl.period * 1.7;
          const STEP = Math.max(30, pl.period / 34);
          let prev: { x: number; y: number } | null = null;
          for (let s0 = TRAIL; s0 >= 0; s0 -= STEP) {
            const tau = t - s0;
            const base = sunPos(tau);
            const th = (tau / pl.period) * Math.PI * 2 + pl.phase;
            const off = Math.sin(th) * pl.r;
            const depth = Math.cos(th);
            const px = base.x + perpX * off + dirX * depth * pl.r * 0.22;
            const py = base.y + perpY * off + dirY * depth * pl.r * 0.22;
            const front = depth > 0;
            if (prev) {
              const k = 1 - s0 / TRAIL;
              const a = (front ? 0.5 : 0.22) * k * solIn * cosmicAlpha;
              g.strokeStyle = `rgba(${pl.color},${a})`;
              g.lineWidth = (front ? 1.5 : 1) / camZ;
              g.beginPath();
              g.moveTo(prev.x, prev.y);
              g.lineTo(px, py);
              g.stroke();
            }
            prev = { x: px, y: py };
          }
          if (prev) {
            const glow = g.createRadialGradient(prev.x, prev.y, 0, prev.x, prev.y, pl.size * 3.2);
            glow.addColorStop(0, `rgba(${pl.color},${0.85 * solIn * cosmicAlpha})`);
            glow.addColorStop(1, `rgba(${pl.color},0)`);
            g.fillStyle = glow;
            g.beginPath();
            g.arc(prev.x, prev.y, pl.size * 3.2, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = `rgba(255,255,255,${0.9 * solIn * cosmicAlpha})`;
            g.beginPath();
            g.arc(prev.x, prev.y, pl.size * 0.7, 0, Math.PI * 2);
            g.fill();
          }
        }

        const corona = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 46);
        corona.addColorStop(0, `rgba(255,250,230,${0.95 * solIn * cosmicAlpha})`);
        corona.addColorStop(0.25, `rgba(255,214,110,${0.75 * solIn * cosmicAlpha})`);
        corona.addColorStop(1, "rgba(255,170,60,0)");
        g.fillStyle = corona;
        g.beginPath();
        g.arc(sun.x, sun.y, 46, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      /* ---- 地球（NASA 実画像）: クローズアップした3番目の惑星からゆっくり浮かび上がる ---- */
      const earthAppear = span(t, 13100, 15700);
      if (earthAppear > 0.001) {
        const cx = fx + panX; // カメラの固定点 = 3番目の惑星の見かけ位置
        const cy = fy + panY;
        const r = 5 + (tr - 5) * easeInOut(span(t, 12800, 15400));
        const mist = easeInOut(span(t, 16400, TOTAL)); // キリの中へ溶けて OTOHIKARI へ譲る
        earth.style.opacity = String(Math.min(1, earthAppear * 1.5) * (1 - mist));
        earth.style.filter = `blur(${(1 - easeInOut(earthAppear)) * 4 + mist * 14}px)`;
        earth.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
        earth.style.width = `${r * 2}px`;
        earth.style.height = `${r * 2}px`;
      }

      /* キリ（靄）の中から OTOHIKARI が現れるフェード */
      const eOut = easeInOut(allOut);
      const fog = allOut > 0 && allOut < 1 ? `blur(${(1 - eOut) * 14}px)` : "none";
      root.style.background = `rgba(2,6,14,${1 - eOut})`;
      root.style.backdropFilter = fog;
      (root.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = fog;
      canvas.style.opacity = String(1 - eOut);

      if (t >= TOTAL && !released) {
        released = true;
        root.style.pointerEvents = "none"; // 文字だけ残し、ページ操作はもう可能に
        document.body.style.overflow = "";
      }
      if (t < LINGER) raf = requestAnimationFrame(draw);
      else finish();
    };

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      document.body.style.overflow = "";
      setShow(false);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  const textBase: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    width: "88%",
    textAlign: "center",
    color: "#f3e3b6",
    fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif',
    textShadow: "0 0 28px rgba(255,214,120,0.5), 0 2px 16px rgba(0,0,0,0.92)",
    pointerEvents: "none",
    opacity: 0,
  };
  /* 「◯◯隊員」「N回目となる」だけ蛍光アクア */
  const aqua: React.CSSProperties = {
    color: "#8ff0e4",
    textShadow: "0 0 24px rgba(64,224,208,0.7), 0 2px 14px rgba(0,0,0,0.92)",
  };

  return (
    <div
      ref={rootRef}
      onClick={() => {
        doneRef.current = true;
        document.body.style.overflow = "";
        setShow(false);
      }}
      className="fixed inset-0 z-[200]"
      style={{ background: "rgba(2,6,14,1)" }}
      aria-label="タップでスキップ"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 地球（NASA ブルーマーブル） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={earthRef}
        src="/space/earth-blue-marble.webp"
        alt=""
        className="absolute left-0 top-0 rounded-full"
        style={{ opacity: 0, willChange: "transform, opacity", boxShadow: "0 0 60px rgba(90,160,255,.35)" }}
      />

      {/* ① 日付（年入り） — 画面のドセンター */}
      <div ref={text1Ref} style={{ ...textBase, top: "50%", fontSize: 25, fontWeight: 600, letterSpacing: 3 }}>
        {dateLine}
      </div>

      {/* ② 隊員3行 — 一行ずつフェード・行間は詰める */}
      <div ref={adv0Ref} style={{ ...textBase, ...aqua, top: "40%", fontSize: 23, fontWeight: 700, letterSpacing: 2 }}>
        {advLines[0]}
      </div>
      <div ref={adv1Ref} style={{ ...textBase, ...aqua, top: "45.5%", fontSize: 19, fontWeight: 600, letterSpacing: 2 }}>
        {advLines[1]}
      </div>
      <div ref={adv2Ref} style={{ ...textBase, top: "51%", fontSize: 23, fontWeight: 700, letterSpacing: 3 }}>
        {advLines[2]}
      </div>

      {/* ③ 今日の地球を、どう楽しむ？ — 地球のど真ん中・着地後も約2秒残る */}
      <div ref={text3Ref} style={{ ...textBase, top: earthCenterY, fontSize: 21, fontWeight: 700, letterSpacing: 3 }}>
        今日の地球を、どう楽しむ？
      </div>
    </div>
  );
}
