"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 朝いちのオープニング（約6秒 + メッセージ残留・タップでスキップ）。
 * 銀河・太陽系・日付・隊員メッセージは無し。
 * 静かな星空に地球の実画像がフェードで現れ、
 * 「今日の地球を、どう楽しむ？」が一文字ずつ灯り、
 * キリ（靄）の中から OTOHIKARI の地球儀へ溶けて着地する。
 * メッセージだけは着地後もしばらく OTOHIKARI の上にフェードで重なる。
 */

const TOTAL = 6000; // 地球フェード〜OTOHIKARI着地
const LINGER = 9200; // メッセージが消え終わるまで

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
  const dateRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<HTMLImageElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const text3Ref = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLDivElement>(null);
  const barBotRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const [earthCenterY, setEarthCenterY] = useState(260);

  useEffect(() => {
    // 朝いち仕様: その日はじめて開いた時だけアニメを流す（リロードでは出ない）。
    // 深夜利用者のため日付の切り替えは AM3:00（0時〜2:59は前日扱い）
    const today = new Date(Date.now() - 3 * 3600 * 1000);
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    try {
      if (localStorage.getItem("onesea-morning-shown") === key) return;
      localStorage.setItem("onesea-morning-shown", key);
    } catch {}
    const d = new Date();
    const yobi = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    setDateLine(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${yobi}）`);
    setShow(true);
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
      tr = r.height * 0.507;
    }
    setEarthCenterY(ty);

    /* 静かな星空 */
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
      s: 0.4 + Math.random() * 1.3,
      tw: Math.random() * Math.PI * 2,
    }));

    const start = performance.now();
    let raf = 0;
    let released = false;

    const draw = (now: number) => {
      const t = now - start;
      if (doneRef.current) return;
      g.clearRect(0, 0, W, H);

      const starIn = span(t, 0, 900);
      const allOut = span(t, 3800, TOTAL);
      const eOut = easeInOut(allOut);
      const cosmicAlpha = 1 - eOut;

      /* 星（ごくゆっくり地球へ引き寄せられる） */
      const zoom = 1 + easeInOut(span(t, 0, TOTAL)) * 0.12;
      g.globalAlpha = starIn * cosmicAlpha;
      for (const s of stars) {
        const par = 1 + (zoom - 1) * s.z;
        const x = tx + (s.x - tx) * par;
        const y = ty + (s.y - ty) * par;
        const twinkle = 0.6 + 0.4 * Math.sin(t / 520 + s.tw);
        g.fillStyle = `rgba(255,255,255,${0.5 * twinkle})`;
        g.fillRect(x, y, s.s, s.s);
      }
      g.globalAlpha = 1;

      /* 地球: 着地点そのものに、ぼかしから静かに現れて等倍へ */
      const ea = easeInOut(span(t, 300, 2600));
      const mist = easeInOut(span(t, 4000, TOTAL));
      const r = tr * (0.84 + 0.16 * ea);
      earth.style.opacity = String(ea * (1 - mist));
      earth.style.filter = `blur(${(1 - ea) * 7 + mist * 14}px)`;
      earth.style.transform = `translate(${tx - r}px, ${ty - r}px)`;
      earth.style.width = `${r * 2}px`;
      earth.style.height = `${r * 2}px`;

      /* 日付 + メッセージ: OTOHIKARI着地後もしばらく重なって残る */
      if (text3Ref.current) {
        const el3 = text3Ref.current;
        const eout3 = easeInOut(span(t, 8000, 9000));
        const ein3 = easeInOut(span(t, 1000, 1800));
        el3.style.opacity = "1";
        el3.style.transform = `translate(-50%, calc(-50% + ${(1 - ein3) * 16}px))`;
        if (dateRef.current) {
          dateRef.current.style.opacity = String(easeInOut(span(t, 1000, 1700)) * (1 - eout3));
        }
        if (msgRef.current) {
          const chars = msgRef.current.children;
          for (let ci = 0; ci < chars.length; ci++) {
            (chars[ci] as HTMLElement).style.opacity = String(
              span(t, 1400 + ci * 90, 2100 + ci * 90) * (1 - eout3)
            );
          }
        }
      }

      /* キリ（靄）の中から OTOHIKARI が現れる */
      const fog = allOut > 0 && allOut < 1 ? `blur(${(1 - eOut) * 14}px)` : "none";
      root.style.background = `rgba(2,6,14,${1 - eOut})`;
      root.style.backdropFilter = fog;
      (root.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = fog;
      canvas.style.opacity = String(1 - eOut);

      /* シネマバーとビネットは着地で開く */
      const barH = H * 0.062 * (1 - eOut);
      if (barTopRef.current) barTopRef.current.style.height = `${barH}px`;
      if (barBotRef.current) barBotRef.current.style.height = `${barH}px`;
      if (vigRef.current) vigRef.current.style.opacity = String(0.85 * (1 - eOut));

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

      {/* 地球（完成版・透過画像） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={earthRef}
        src="/space/earth-japan.webp"
        alt=""
        className="absolute left-0 top-0"
        style={{ opacity: 0, willChange: "transform, opacity", filter: "blur(7px)" }}
      />

      {/* ①日付 ②今日の地球を、どう楽しむ？（行間は詰める）— 着地後もしばらく残る */}
      <div ref={text3Ref} style={{ ...textBase, top: earthCenterY }}>
        <div
          ref={dateRef}
          className="num"
          style={{ opacity: 0, fontSize: 15, fontWeight: 600, letterSpacing: 2, lineHeight: 1.3 }}
        >
          {dateLine}
        </div>
        <div style={{ marginTop: 2, fontSize: 21, fontWeight: 700, letterSpacing: 3, lineHeight: 1.4 }} ref={msgRef}>
          {Array.from("今日の地球を、どう楽しむ？").map((c, i) => (
            <span key={i} style={{ opacity: 0, display: "inline-block" }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* シネマバー + ビネット */}
      <div ref={barTopRef} className="pointer-events-none absolute left-0 right-0 top-0 bg-black" style={{ height: "6.2vh" }} />
      <div ref={barBotRef} className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black" style={{ height: "6.2vh" }} />
      <div
        ref={vigRef}
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(2,4,12,0.55) 100%)" }}
      />
    </div>
  );
}
