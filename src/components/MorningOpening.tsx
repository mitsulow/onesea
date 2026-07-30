"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { YOBI } from "@/lib/almanac";

/**
 * 朝いちのオープニング（その日最初に開いた時だけ・約3秒・タップでスキップ）。
 * 宇宙 → 天の川銀河（日付） → 太陽系（◯回目の地球冒険） → 地球クローズアップ
 * →「今日は、地球をどう楽しもうか？」→ OTOHIKARI の地球儀へぴったり着地してクロスフェード。
 * 星・銀河・太陽系はすべて Canvas 描画（0KB）。地球だけ NASA ブルーマーブル実画像（70KB）。
 * フェードの気持ちよさはツキヨガ準拠: scale 1.08→1 / 文字は下から20px / cubic-bezier(0.22,1,0.36,1)
 */

const TOTAL = 7400;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
/** 区間 [a,b] 内の進行率 */
function span(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

export function MorningOpening() {
  const [show, setShow] = useState(false);
  const [lines, setLines] = useState<{ date: string; adventure: string }>({ date: "", adventure: "" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<HTMLImageElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const text1Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLDivElement>(null);
  const text3Ref = useRef<HTMLDivElement>(null);

  // その日最初のオープンだけ
  useEffect(() => {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    // チェック期間中はリロードのたびに毎回表示。
    // 本番運用に戻すときは下のコメントを解除（その日最初の1回だけになる）
    // try {
    //   if (localStorage.getItem("onesea-morning-shown") === key) return;
    //   localStorage.setItem("onesea-morning-shown", key);
    // } catch {}
    void key;

    const dateLine = `${today.getMonth() + 1}月${today.getDate()}日 ${YOBI[today.getDay()]}曜日`;
    setLines({ date: dateLine, adventure: "今日も、地球冒険の日" });
    setShow(true);

    // 名前と誕生日 → ◯回目の地球冒険
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user;
      if (!u) return;
      const [{ data: prof }, { data: priv }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", u.id).maybeSingle(),
        supabase.from("private_profiles").select("birth_date").eq("user_id", u.id).maybeSingle(),
      ]);
      const name = prof?.display_name ?? "";
      if (priv?.birth_date) {
        const days =
          Math.floor((today.setHours(0, 0, 0, 0) - new Date(priv.birth_date + "T00:00:00").getTime()) / 86400000) + 1;
        setLines((prev) => ({ ...prev, adventure: `${name ? name + "、" : ""}${days.toLocaleString()}回目の地球冒険の日` }));
      } else if (name) {
        setLines((prev) => ({ ...prev, adventure: `${name}、今日も地球冒険の日` }));
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

    /* 着地点: OTOHIKARI の地球儀と同じ位置・同じ大きさ */
    let tx = W / 2;
    let ty = Math.min(H * 0.42, 320);
    let tr = Math.min(W, 360) * 0.42;
    const globeEl = document.getElementById("otohikari-globe");
    if (globeEl) {
      const r = globeEl.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
      tr = r.height * 0.423; // 球の投影半径（fov45° z2.85 → 高さの約84.5%が直径）
    }

    /* 星（前景視差つき） */
    const stars = Array.from({ length: 230 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
      s: 0.4 + Math.random() * 1.3,
      tw: Math.random() * Math.PI * 2,
    }));

    /* 天の川（バンド状のパーティクル群） */
    const gal = Array.from({ length: 1500 }, () => {
      const along = (Math.random() - 0.5) * 2; // -1..1 バンド方向
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ガウス風
      const bright = Math.random();
      return { along, spread, bright, tw: Math.random() * Math.PI * 2 };
    });

    /* 太陽系の惑星（決め打ち配置） */
    const planets = [
      { r: 34, size: 2.2, ang: 0.6, color: "#b8b0a0" },
      { r: 52, size: 3.4, ang: 2.4, color: "#e8c87a" },
      { r: 72, size: 3.8, ang: 4.4, color: "#6aa8e8" }, // 地球
      { r: 92, size: 3.0, ang: 1.4, color: "#e07a50" },
      { r: 120, size: 7.0, ang: 3.3, color: "#d8a878" },
      { r: 148, size: 6.0, ang: 5.3, color: "#e8d8a8" },
      { r: 172, size: 4.4, ang: 0.2, color: "#a8d8e8" },
      { r: 194, size: 4.2, ang: 2.9, color: "#7a90e8" },
    ];

    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = now - start;
      if (doneRef.current) return;
      g.clearRect(0, 0, W, H);

      /* ---- フェーズ進行（読める速度・全部同じ時計） ---- */
      const starIn = span(t, 0, 800); // 星が生まれる
      const galIn = span(t, 500, 1500) * (1 - span(t, 2700, 3400)); // 天の川
      const galZoom = 1 + easeInOut(span(t, 1200, 3400)) * 2.6; // 銀河に向かって進む
      const solIn = span(t, 2700, 3500) * (1 - span(t, 4900, 5600)); // 太陽系
      const solZoom = 0.7 + easeInOut(span(t, 2700, 5300)) * 1.5;
      const earthIn = span(t, 4900, 6300); // 地球クローズアップ
      const allOut = span(t, 6500, TOTAL); // 宇宙は暮れて OTOHIKARI へ

      /* ---- テキスト（rAF同一時計・機種に依存しない） ---- */
      const textAnim = (
        el: HTMLDivElement | null,
        inA: number,
        inB: number,
        outA: number,
        outB: number
      ) => {
        if (!el) return;
        const ein = easeInOut(span(t, inA, inB));
        const eout = span(t, outA, outB);
        el.style.opacity = String(ein * (1 - eout));
        el.style.transform = `translate(-50%, ${(1 - ein) * 22}px) scale(${1.04 - ein * 0.04})`;
      };
      textAnim(text1Ref.current, 900, 1650, 2700, 3200); // 日付（天の川）
      textAnim(text2Ref.current, 3100, 3850, 4900, 5400); // ◯回目の地球冒険（太陽系）
      textAnim(text3Ref.current, 5300, 6050, 6800, 7300); // 今日は、地球をどう楽しもうか？

      const cosmicAlpha = (1 - allOut) * 0.98;

      /* ---- 星 ---- */
      g.globalAlpha = starIn * cosmicAlpha;
      for (const s of stars) {
        const par = 1 + (galZoom - 1) * s.z * 0.35; // 視差
        const x = tx + (s.x - tx) * par;
        const y = ty + (s.y - ty) * par;
        const twinkle = 0.6 + 0.4 * Math.sin(t / 400 + s.tw);
        g.fillStyle = `rgba(255,255,255,${0.5 * twinkle})`;
        g.fillRect(x, y, s.s, s.s);
      }

      /* ---- 天の川銀河 ---- */
      if (galIn > 0.01) {
        g.save();
        g.translate(W / 2, H * 0.42);
        g.rotate(-0.42);
        g.scale(galZoom, galZoom);
        const bandLen = W * 0.62;
        const bandWid = W * 0.16;
        // もや（コア）
        const halo = g.createRadialGradient(0, 0, 0, 0, 0, bandLen * 0.75);
        halo.addColorStop(0, `rgba(255,246,224,${0.30 * galIn})`);
        halo.addColorStop(0.35, `rgba(180,190,235,${0.16 * galIn})`);
        halo.addColorStop(1, "rgba(140,150,220,0)");
        g.fillStyle = halo;
        g.save();
        g.scale(1, bandWid / (bandLen * 0.75));
        g.beginPath();
        g.arc(0, 0, bandLen * 0.75, 0, Math.PI * 2);
        g.fill();
        g.restore();
        // 星の粒
        for (const p of gal) {
          const x = p.along * bandLen;
          const y = p.spread * bandWid * (1 - Math.abs(p.along) * 0.45);
          const core = 1 - Math.min(1, (Math.abs(p.along) * 1.2 + Math.abs(p.spread)) * 0.85);
          const twinkle = 0.7 + 0.3 * Math.sin(t / 600 + p.tw);
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

      /* ---- 太陽系 ---- */
      if (solIn > 0.01) {
        g.save();
        g.translate(W / 2, H * 0.44);
        g.scale(solZoom, solZoom);
        // 太陽
        const sun = g.createRadialGradient(0, 0, 0, 0, 0, 30);
        sun.addColorStop(0, `rgba(255,244,214,${solIn})`);
        sun.addColorStop(0.4, `rgba(255,208,110,${0.85 * solIn})`);
        sun.addColorStop(1, "rgba(240,150,50,0)");
        g.fillStyle = sun;
        g.beginPath();
        g.arc(0, 0, 30, 0, Math.PI * 2);
        g.fill();
        // 軌道と惑星
        for (const p of planets) {
          g.strokeStyle = `rgba(200,210,235,${0.13 * solIn})`;
          g.lineWidth = 0.7 / solZoom;
          g.beginPath();
          g.ellipse(0, 0, p.r, p.r * 0.36, 0, 0, Math.PI * 2);
          g.stroke();
          const px = Math.cos(p.ang + t / 9000) * p.r;
          const py = Math.sin(p.ang + t / 9000) * p.r * 0.36;
          const isEarth = p.color === "#6aa8e8";
          if (isEarth) {
            const gl = g.createRadialGradient(px, py, 0, px, py, p.size * 3);
            gl.addColorStop(0, `rgba(120,190,255,${0.6 * solIn})`);
            gl.addColorStop(1, "rgba(120,190,255,0)");
            g.fillStyle = gl;
            g.beginPath();
            g.arc(px, py, p.size * 3, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = p.color;
          g.globalAlpha = solIn * cosmicAlpha;
          g.beginPath();
          g.arc(px, py, p.size, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
        }
        g.restore();
      }

      /* ---- 地球（実画像）を着地点へ ---- */
      if (earthIn > 0.001) {
        const e = easeInOut(earthIn);
        const startR = Math.max(W, H) * 0.02;
        const r = startR + (tr - startR) * e;
        const sx = W / 2 + (tx - W / 2) * e;
        const sy = H * 0.44 + (ty - H * 0.44) * e;
        const fadeOut = 1 - span(t, 6900, TOTAL); // 最後は OTOHIKARI へ譲る
        earth.style.opacity = String(Math.min(1, earthIn * 2.2) * fadeOut);
        earth.style.transform = `translate(${sx - r}px, ${sy - r}px)`;
        earth.style.width = `${r * 2}px`;
        earth.style.height = `${r * 2}px`;
      }

      /* ---- 背景の黒をフェードアウト ---- */
      if (root) root.style.background = `rgba(2,6,14,${1 - easeInOut(allOut)})`;
      if (canvas) canvas.style.opacity = String(1 - easeInOut(allOut));

      if (t < TOTAL) raf = requestAnimationFrame(draw);
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
    color: "#f4efd8",
    textShadow: "0 0 24px rgba(110,196,245,0.5), 0 2px 16px rgba(0,0,0,0.9)",
    pointerEvents: "none",
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

      {/* ① 日付（天の川） */}
      <div
        ref={text1Ref}
        style={{ ...textBase, top: "24%", transform: "translateX(-50%)", opacity: 0, fontSize: 21, fontWeight: 700, letterSpacing: 3 }}
        className="num"
      >
        {lines.date}
      </div>

      {/* ② ◯回目の地球冒険（太陽系） */}
      <div
        ref={text2Ref}
        style={{ ...textBase, top: "22%", transform: "translateX(-50%)", opacity: 0, fontSize: 18, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1.7 }}
        className="num"
      >
        {lines.adventure}
      </div>

      {/* ③ 今日は、地球をどう楽しもうか？ */}
      <div
        ref={text3Ref}
        style={{ ...textBase, top: "18%", transform: "translateX(-50%)", opacity: 0, fontSize: 19, fontWeight: 800, letterSpacing: 2 }}
      >
        今日は、地球をどう楽しもうか？
      </div>

    </div>
  );
}
