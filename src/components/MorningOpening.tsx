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
  const rimRef = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLDivElement>(null);
  const barBotRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
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

    /* 星（3層パララックス） */
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.25 + Math.random() * 0.75,
      s: 0.4 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
    }));

    /* 星雲（オフスクリーンに一度だけ描く） */
    const neb = document.createElement("canvas");
    neb.width = neb.height = 512;
    const ng = neb.getContext("2d")!;
    const blobs: Array<[number, number, string, number]> = [
      [160, 180, "40,60,140", 170],
      [340, 220, "90,50,150", 190],
      [250, 360, "30,110,140", 170],
      [410, 120, "120,60,160", 130],
      [110, 390, "50,80,160", 150],
    ];
    for (const [bx, by, c, br] of blobs) {
      const g2 = ng.createRadialGradient(bx, by, 0, bx, by, br);
      g2.addColorStop(0, `rgba(${c},0.5)`);
      g2.addColorStop(1, `rgba(${c},0)`);
      ng.fillStyle = g2;
      ng.fillRect(0, 0, 512, 512);
    }

    /* 流れ星（時刻固定の2発） */
    const shoots = [
      { t0: 3400, x: W * 0.16, y: H * 0.16, ang: 0.45 },
      { t0: 9200, x: W * 0.68, y: H * 0.1, ang: 2.5 },
    ];

    /* 銀河系（渦巻銀河）を一度だけオフスクリーンに描き込む
       — 毎フレームはこの絵をズーム表示するだけなので星を贅沢に使える */
    const GAL = 1100;
    const galCv = document.createElement("canvas");
    galCv.width = GAL;
    galCv.height = GAL;
    const gg = galCv.getContext("2d")!;
    const GC = GAL / 2;
    let grad = gg.createRadialGradient(GC, GC, 0, GC, GC, GC * 0.98);
    grad.addColorStop(0, "rgba(90,80,140,0.35)");
    grad.addColorStop(0.5, "rgba(60,55,110,0.16)");
    grad.addColorStop(1, "rgba(30,30,70,0)");
    gg.fillStyle = grad;
    gg.fillRect(0, 0, GAL, GAL);
    for (let i = 0; i < 9000; i++) {
      const arm = Math.random() < 0.5 ? 0 : 1;
      const rad = Math.pow(Math.random(), 0.62);
      const ang = arm * Math.PI + rad * 4.6 + (Math.random() - 0.5) * (1.1 - rad * 0.75);
      const rr = rad * GC * 0.92 * (0.75 + Math.random() * 0.3);
      const x = GC + Math.cos(ang) * rr;
      const y = GC + Math.sin(ang) * rr;
      const b = Math.random();
      let col: string;
      if (rad < 0.25) col = `rgba(255,238,205,${0.25 + b * 0.5})`; // 中心部は暖色
      else if (b > 0.93) col = `rgba(255,190,210,${0.5 + b * 0.3})`; // 腕のピンク（星形成域）
      else if (b > 0.55) col = `rgba(200,215,255,${0.25 + b * 0.45})`; // 青白い若い星
      else col = `rgba(150,165,235,${0.12 + b * 0.3})`;
      gg.fillStyle = col;
      const sz = b > 0.9 ? 2.2 : b > 0.6 ? 1.6 : 1.1;
      gg.fillRect(x, y, sz, sz);
      if (b > 0.965) {
        const gl = gg.createRadialGradient(x, y, 0, x, y, 5);
        gl.addColorStop(0, "rgba(220,230,255,0.5)");
        gl.addColorStop(1, "rgba(220,230,255,0)");
        gg.fillStyle = gl;
        gg.fillRect(x - 5, y - 5, 10, 10);
      }
    }
    /* 中心バルジ: 白熱の核 + 暖色のかさ */
    grad = gg.createRadialGradient(GC, GC, 0, GC, GC, GC * 0.3);
    grad.addColorStop(0, "rgba(255,250,235,0.95)");
    grad.addColorStop(0.25, "rgba(255,235,195,0.6)");
    grad.addColorStop(1, "rgba(255,220,170,0)");
    gg.fillStyle = grad;
    gg.beginPath();
    gg.arc(GC, GC, GC * 0.3, 0, Math.PI * 2);
    gg.fill();
    grad = gg.createRadialGradient(GC, GC, 0, GC, GC, GC * 0.09);
    grad.addColorStop(0, "rgba(255,255,250,1)");
    grad.addColorStop(1, "rgba(255,245,220,0)");
    gg.fillStyle = grad;
    gg.beginPath();
    gg.arc(GC, GC, GC * 0.09, 0, Math.PI * 2);
    gg.fill();

    /* らせん太陽系（djsadhu 風） */
    const AXIS = -0.1;
    const dirX = -Math.cos(AXIS);
    const dirY = -Math.sin(AXIS); // 右→左へ進む
    const perpX = -dirY;
    const perpY = dirX;
    const SOL_T0 = 6700;
    const SOL_T1 = 13900;
    /* 8惑星（水金地火木土天海・実際に近い色味） */
    const helixPlanets = [
      { r: 10, period: 700, phase: 0.0, color: "175,175,185", size: 1.3 }, // 水星
      { r: 15, period: 1050, phase: 2.6, color: "255,222,150", size: 2.0 }, // 金星
      { r: 21, period: 1500, phase: 4.2, color: "110,190,255", size: 2.4 }, // 地球
      { r: 27, period: 2000, phase: 1.2, color: "255,140,100", size: 1.8 }, // 火星
      { r: 38, period: 2800, phase: 3.4, color: "240,205,160", size: 3.6 }, // 木星
      { r: 48, period: 3700, phase: 5.5, color: "235,215,170", size: 3.2 }, // 土星
      { r: 57, period: 4600, phase: 0.8, color: "170,230,240", size: 2.6 }, // 天王星
      { r: 65, period: 5500, phase: 2.0, color: "130,170,255", size: 2.5 }, // 海王星
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
    let prevGalZoom = 1;

    const draw = (now: number) => {
      const t = now - start;
      if (doneRef.current) return;
      g.clearRect(0, 0, W, H);

      /* ---- フェーズ ---- */
      const starIn = span(t, 0, 1400);
      /* 銀河はズームし続けながら（ピタッと止まらない）太陽系にバトンを渡す */
      const galIn = span(t, 1000, 3100) * (1 - span(t, 6800, 9600));
      const galZoom = 1 + easeInOut(span(t, 2200, 10600)) * 3.6;
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
      /* 最後のメッセージは一文字ずつ浮かび上がる */
      if (text3Ref.current) {
        const el3 = text3Ref.current;
        const eout3 = span(t, 19300, 20400);
        const ein3 = easeInOut(span(t, 14800, 15600));
        el3.style.opacity = "1";
        el3.style.transform = `translate(-50%, calc(-50% + ${(1 - ein3) * 20}px))`;
        const chars = el3.children;
        for (let ci = 0; ci < chars.length; ci++) {
          (chars[ci] as HTMLElement).style.opacity = String(
            span(t, 14800 + ci * 90, 15500 + ci * 90) * (1 - eout3)
          );
        }
      }

      /* ---- 星雲（宇宙の奥行き。銀河ズームとともに退場） ---- */
      const nebIn = starIn * (1 - span(t, 5200, 8600));
      if (nebIn > 0.01) {
        g.save();
        g.globalAlpha = 0.45 * nebIn * cosmicAlpha;
        g.translate(W / 2, H * 0.45);
        g.rotate(t * 0.00001);
        const ns = Math.max(W, H) * 1.35 * (1 + (galZoom - 1) * 0.15);
        g.drawImage(neb, -ns / 2, -ns / 2, ns, ns);
        g.restore();
        g.globalAlpha = 1;
      }

      /* ---- 星（ズーム中はワープの流線になる） ---- */
      const zoomVel = galZoom - prevGalZoom;
      prevGalZoom = galZoom;
      g.globalAlpha = starIn * cosmicAlpha;
      for (const s of stars) {
        const par = 1 + (galZoom - 1) * s.z * 0.35;
        const x = tx + (s.x - tx) * par;
        const y = ty + (s.y - ty) * par;
        const twinkle = 0.6 + 0.4 * Math.sin(t / 500 + s.tw);
        const dx = x - tx;
        const dy = y - ty;
        const dist = Math.hypot(dx, dy) || 1;
        const L = Math.min(22, zoomVel * 2600 * s.z);
        if (L > 1.6) {
          g.strokeStyle = `rgba(255,255,255,${0.4 * twinkle})`;
          g.lineWidth = s.s * 0.8;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - (dx / dist) * L, y - (dy / dist) * L);
          g.stroke();
        } else {
          g.fillStyle = `rgba(255,255,255,${0.5 * twinkle})`;
          g.fillRect(x, y, s.s, s.s);
        }
      }
      g.globalAlpha = 1;

      /* ---- 流れ星 ---- */
      for (const s of shoots) {
        const k = span(t, s.t0, s.t0 + 800);
        if (k <= 0 || k >= 1) continue;
        const a = Math.sin(Math.PI * k) * cosmicAlpha;
        const px = s.x + Math.cos(s.ang) * 300 * k;
        const py = s.y + Math.sin(s.ang) * 140 * k;
        const tail = 90;
        const gr = g.createLinearGradient(px, py, px - Math.cos(s.ang) * tail, py - Math.sin(s.ang) * tail);
        gr.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.strokeStyle = gr;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px - Math.cos(s.ang) * tail, py - Math.sin(s.ang) * tail);
        g.stroke();
      }

      /* ---- 銀河系（渦巻銀河・傾いた円盤 + ゆっくり自転しながらズーム） ---- */
      if (galIn > 0.01) {
        g.save();
        g.translate(W / 2, H * 0.42);
        g.rotate(-0.42 + t * 0.000018); // ごくゆっくり自転
        g.scale(galZoom, galZoom * 0.42); // 斜めから見た円盤
        g.globalAlpha = galIn * cosmicAlpha;
        const gw = W * 0.88;
        g.drawImage(galCv, -gw / 2, -gw / 2, gw, gw);
        g.globalAlpha = 1;
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

        /* 太陽の金の尾（淡い太グロー + 明るい芯の二重描き） */
        const TAIL = 3000;
        for (let s0 = TAIL; s0 > 0; s0 -= 80) {
          const a = sunPos(t - s0);
          const b = sunPos(t - s0 + 80);
          const k = 1 - s0 / TAIL;
          const al = k * solIn * cosmicAlpha;
          g.strokeStyle = `rgba(255,200,90,${0.14 * al})`;
          g.lineWidth = 7 / camZ;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
          g.strokeStyle = `rgba(255,224,140,${0.42 * al})`;
          g.lineWidth = 2 / camZ;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }

        /* 惑星のらせん軌跡（本家風: 淡いグロー + 芯の二重、奥は暗く手前は明るく） */
        for (const pl of helixPlanets) {
          const TRAIL = pl.period * 2.0;
          const STEP = Math.max(26, pl.period / 32);
          const pts: { x: number; y: number; front: boolean }[] = [];
          for (let s0 = TRAIL; s0 >= 0; s0 -= STEP) {
            const tau = t - s0;
            const base = sunPos(tau);
            const th = (tau / pl.period) * Math.PI * 2 + pl.phase;
            const off = Math.sin(th) * pl.r;
            const depth = Math.cos(th);
            pts.push({
              x: base.x + perpX * off + dirX * depth * pl.r * 0.22,
              y: base.y + perpY * off + dirY * depth * pl.r * 0.22,
              front: depth > 0,
            });
          }
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const k = i / pts.length;
            const base = (p1.front ? 1 : 0.42) * k * solIn * cosmicAlpha;
            g.strokeStyle = `rgba(${pl.color},${0.16 * base})`;
            g.lineWidth = 4.5 / camZ;
            g.beginPath();
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.stroke();
            g.strokeStyle = `rgba(${pl.color},${0.55 * base})`;
            g.lineWidth = 1.3 / camZ;
            g.beginPath();
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.stroke();
          }
          const hp = pts[pts.length - 1];
          const glow = g.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, pl.size * 3.4);
          glow.addColorStop(0, `rgba(${pl.color},${0.9 * solIn * cosmicAlpha})`);
          glow.addColorStop(1, `rgba(${pl.color},0)`);
          g.fillStyle = glow;
          g.beginPath();
          g.arc(hp.x, hp.y, pl.size * 3.4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = `rgba(255,255,255,${0.92 * solIn * cosmicAlpha})`;
          g.beginPath();
          g.arc(hp.x, hp.y, pl.size * 0.7, 0, Math.PI * 2);
          g.fill();
          if (pl.r === 48) {
            // 土星の環
            g.save();
            g.translate(hp.x, hp.y);
            g.rotate(-0.45);
            g.scale(1, 0.35);
            g.strokeStyle = `rgba(235,215,170,${0.7 * solIn * cosmicAlpha})`;
            g.lineWidth = 1.2 / camZ;
            g.beginPath();
            g.arc(0, 0, pl.size * 2.1, 0, Math.PI * 2);
            g.stroke();
            g.restore();
          }
        }

        /* 太陽コロナ（3層） */
        const coronaLayers: [number, string, string][] = [
          [78, "rgba(255,180,70,0.20)", "rgba(255,150,50,0)"],
          [46, "rgba(255,214,110,0.75)", "rgba(255,170,60,0)"],
          [22, "rgba(255,252,240,0.98)", "rgba(255,230,160,0)"],
        ];
        for (const [rr, c0, c1] of coronaLayers) {
          const corona = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, rr);
          corona.addColorStop(0, c0.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * solIn * cosmicAlpha) + ")"));
          corona.addColorStop(1, c1);
          g.fillStyle = corona;
          g.beginPath();
          g.arc(sun.x, sun.y, rr, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();

        /* レンズフレア（スクリーン空間で太陽の位置に） */
        const sunScr = {
          x: (sun.x - fx) * camZ + fx + panX,
          y: (sun.y - fy) * camZ + fy + panY,
        };
        const fl = solIn * cosmicAlpha;
        const streak = g.createLinearGradient(sunScr.x - W * 0.45, sunScr.y, sunScr.x + W * 0.45, sunScr.y);
        streak.addColorStop(0, "rgba(255,200,120,0)");
        streak.addColorStop(0.5, `rgba(255,228,175,${0.3 * fl})`);
        streak.addColorStop(1, "rgba(255,200,120,0)");
        g.fillStyle = streak;
        g.fillRect(sunScr.x - W * 0.45, sunScr.y - 1.2, W * 0.9, 2.4);
        for (const [k, r2, a2] of [
          [0.7, 9, 0.12],
          [1.35, 15, 0.07],
        ] as const) {
          const gx2 = sunScr.x + (W / 2 - sunScr.x) * k;
          const gy2 = sunScr.y + (H / 2 - sunScr.y) * k;
          const gg2 = g.createRadialGradient(gx2, gy2, 0, gx2, gy2, r2);
          gg2.addColorStop(0, `rgba(200,230,255,${a2 * fl})`);
          gg2.addColorStop(1, "rgba(200,230,255,0)");
          g.fillStyle = gg2;
          g.beginPath();
          g.arc(gx2, gy2, r2, 0, Math.PI * 2);
          g.fill();
        }
      }

      /* ---- 地球（NASA 実画像）: ズーム中からもうフェードで重なり始めている ---- */
      const earthAppear = span(t, 12300, 15200);
      if (earthAppear > 0.001) {
        // 惑星の見かけ位置から早めに着地点へロック（軌道の上下揺れを画像に伝えない）
        const lockT = easeInOut(span(t, 12300, 14000));
        const cx = (fx + panX) * (1 - lockT) + tx * lockT;
        const cy = (fy + panY) * (1 - lockT) + ty * lockT;
        const r = 5 + (tr - 5) * easeInOut(span(t, 12300, 15000));
        const mist = easeInOut(span(t, 16400, TOTAL)); // キリの中へ溶けて OTOHIKARI へ譲る
        earth.style.opacity = String(easeInOut(earthAppear) * (1 - mist));
        earth.style.filter = `blur(${(1 - easeInOut(earthAppear)) * 4 + mist * 14}px)`;
        earth.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
        earth.style.width = `${r * 2}px`;
        earth.style.height = `${r * 2}px`;
        /* 大気のリム光 */
        const rim = rimRef.current;
        if (rim) {
          const rr = r * 1.05;
          rim.style.opacity = String(easeInOut(earthAppear) * (1 - mist) * 0.95);
          rim.style.transform = `translate(${cx - rr}px, ${cy - rr}px)`;
          rim.style.width = `${rr * 2}px`;
          rim.style.height = `${rr * 2}px`;
        }
      }

      /* キリ（靄）の中から OTOHIKARI が現れるフェード */
      const eOut = easeInOut(allOut);
      const fog = allOut > 0 && allOut < 1 ? `blur(${(1 - eOut) * 14}px)` : "none";
      root.style.background = `rgba(2,6,14,${1 - eOut})`;
      root.style.backdropFilter = fog;
      (root.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = fog;
      canvas.style.opacity = String(1 - eOut);

      /* シネマバー（上下の黒帯）は最後に開いていく */
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
        style={{ opacity: 0, willChange: "transform, opacity", boxShadow: "0 0 70px rgba(90,160,255,.4), 0 0 18px rgba(140,200,255,.55)" }}
      />
      {/* 大気のリム光 */}
      <div
        ref={rimRef}
        className="pointer-events-none absolute left-0 top-0 rounded-full"
        style={{
          opacity: 0,
          willChange: "transform, opacity",
          background:
            "radial-gradient(circle at 38% 32%, rgba(0,0,0,0) 58%, rgba(140,200,255,0.08) 72%, rgba(150,210,255,0.35) 88%, rgba(160,220,255,0) 97%)",
        }}
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

      {/* ③ 今日の地球を、どう楽しむ？ — 一文字ずつ・地球のど真ん中・着地後も約2秒残る */}
      <div ref={text3Ref} style={{ ...textBase, top: earthCenterY, fontSize: 21, fontWeight: 700, letterSpacing: 3 }}>
        {Array.from("今日の地球を、どう楽しむ？").map((c, i) => (
          <span key={i} style={{ opacity: 0, display: "inline-block" }}>
            {c}
          </span>
        ))}
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
