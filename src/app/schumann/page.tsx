"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SCHUMANN_DATA_URL, TARGET_HZ } from "@/lib/config";

/**
 * シューマン共振ダッシュボード（OneSea内蔵版）。
 * 旧 mitsulow.github.io/schumann は別ドメインのためPWAで×バーが出ていた。
 * データは 0Lei リポジトリの実測JSON（現在値 + 履歴）をそのまま利用。
 */

const HISTORY_URL = "https://mitsulow.github.io/0Lei/schumann_history.json";
const CYAN = "#8ff4ff";

interface Mode {
  hz: number | null;
  confidence?: number;
  amp?: number;
}
interface Live {
  timestamp?: string;
  updated_jst?: string;
  modes?: Record<string, Mode>;
  notes?: string;
  condition?: string;
  polarization?: { state_jp?: string };
  data_age_min?: Record<string, number>;
}
interface HistRow {
  t?: string;
  timestamp?: string;
  F1?: number | null;
}

const CONDITION_JP: Record<string, [string, string]> = {
  calm: ["静穏", "#7ad8a8"],
  normal: ["通常", "#7ad8a8"],
  active: ["活発", "#e8cc70"],
  storm: ["嵐（強い活動）", "#ff9060"],
  quiet: ["静か", "#7ad8a8"],
};

export default function SchumannPage() {
  const [live, setLive] = useState<Live | null>(null);
  const [hist, setHist] = useState<HistRow[]>([]);

  useEffect(() => {
    const load = () => {
      fetch(`${SCHUMANN_DATA_URL}?t=${Date.now()}`)
        .then((r) => r.json())
        .then(setLive)
        .catch(() => {});
      fetch(HISTORY_URL)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setHist(d))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const f1 = live?.modes?.F1?.hz ?? null;
  const diff = f1 != null ? TARGET_HZ - f1 : null;
  const cond = live?.condition ? (CONDITION_JP[live.condition] ?? [live.condition, "#8aa8c0"]) : null;

  /* 直近7日のF1履歴 */
  const chart = useMemo(() => {
    const now = Date.now();
    const from = now - 7 * 86400000;
    const pts = hist
      .map((r) => ({ time: Date.parse(r.t ?? r.timestamp ?? ""), v: r.F1 ?? null }))
      .filter((p) => Number.isFinite(p.time) && p.time >= from && p.v != null) as Array<{ time: number; v: number }>;
    if (pts.length < 2) return null;
    const W = 340;
    const H = 120;
    const vMin = Math.min(...pts.map((p) => p.v), TARGET_HZ) - 0.08;
    const vMax = Math.max(...pts.map((p) => p.v), TARGET_HZ) + 0.08;
    const x = (t: number) => ((t - from) / (now - from)) * W;
    const y = (v: number) => H - ((v - vMin) / (vMax - vMin)) * H;
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const days: Array<{ x: number; label: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      days.push({ x: x(now - i * 86400000), label: `${d.getMonth() + 1}/${d.getDate()}` });
    }
    return { W, H, line, targetY: y(TARGET_HZ), days, vMin, vMax, last: pts[pts.length - 1] };
  }, [hist]);

  const modeRows = (["F1", "F2", "F3", "F4"] as const).map((k) => ({
    key: k,
    m: live?.modes?.[k],
    age: live?.data_age_min?.[k],
  }));

  return (
    <main className="min-h-screen pb-24" style={{ background: "linear-gradient(180deg,#050a14,#0a1a2e)" }}>
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <Link href="/" className="text-[13px] font-bold text-[#7ab8d8] no-underline">
          ◀ ホーム
        </Link>
        <span
          className="text-[15px] font-extrabold tracking-[2px]"
          style={{ color: CYAN, textShadow: "0 0 8px rgba(120,235,255,.9), 0 0 20px rgba(60,210,255,.5)" }}
        >
          ▽SCHUMANN RESONANCE
        </span>
        <span className="w-12" />
      </header>
      {live?.updated_jst && (
        <div className="num px-4 text-right text-[9.5px] text-[#5a7a9a]">実測 {live.updated_jst} 更新</div>
      )}

      {/* いまのF1 */}
      <div className="mt-3 px-4 text-center">
        <div className="text-[10px] tracking-[4px] text-[#7fa08c]">いまのシューマン電磁波（F1）</div>
        <div
          className="num mt-1 text-[56px] font-extrabold leading-none"
          style={{ color: CYAN, textShadow: "0 0 18px rgba(120,235,255,.8), 0 0 40px rgba(60,210,255,.4)" }}
        >
          {f1 != null ? f1.toFixed(2) : "—"}
          <span className="ml-1 text-[20px]">Hz</span>
        </div>
        <div className="num mt-1.5 text-[12px] text-[#8aa8d0]">
          目標 {TARGET_HZ.toFixed(4)}Hz まで {diff != null ? `${diff >= 0 ? "＋" : "−"}${Math.abs(diff).toFixed(2)}Hz` : "—"}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          {cond && (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-extrabold"
              style={{ background: "rgba(255,255,255,.06)", color: cond[1], border: `1px solid ${cond[1]}55` }}
            >
              {cond[0]}
            </span>
          )}
          {live?.polarization?.state_jp && (
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-[#8aa8c0]">
              {live.polarization.state_jp}
            </span>
          )}
        </div>
      </div>

      {/* 7日間グラフ */}
      <div className="mt-5 px-3">
        <div className="mb-1 px-1 text-[10px] tracking-[3px] text-[#5a7a9a]">F1 — 直近7日間</div>
        <div className="rounded-xl border border-[#1a3048] bg-[#081220] p-2">
          {chart ? (
            <svg viewBox={`0 0 ${chart.W} ${chart.H + 16}`} className="w-full">
              {/* 目標ライン */}
              <line
                x1={0}
                y1={chart.targetY}
                x2={chart.W}
                y2={chart.targetY}
                stroke={CYAN}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.5"
              />
              <text x={2} y={chart.targetY - 3} fontSize="7" fill={CYAN} opacity="0.8">
                目標 {TARGET_HZ.toFixed(2)}
              </text>
              {/* 実測ライン */}
              <path d={chart.line} fill="none" stroke="#40d8f0" strokeWidth="1.6" strokeLinejoin="round" opacity="0.95" />
              {/* 日付目盛り */}
              {chart.days.map((d, i) => (
                <text key={i} x={d.x} y={chart.H + 12} fontSize="7" fill="#4a6a88" textAnchor="middle">
                  {d.label}
                </text>
              ))}
            </svg>
          ) : (
            <p className="py-8 text-center text-[11px] text-[#5a7a9a]">履歴を読み込んでいます...</p>
          )}
        </div>
      </div>

      {/* モード一覧 */}
      <div className="mt-4 px-3">
        <div className="mb-1 px-1 text-[10px] tracking-[3px] text-[#5a7a9a]">共振モード</div>
        <div className="grid grid-cols-4 gap-1.5">
          {modeRows.map(({ key, m, age }) => (
            <div key={key} className="rounded-xl border border-[#1a3048] bg-[#081220] px-1 py-2 text-center">
              <div className="text-[9px] font-bold tracking-[2px] text-[#5a7a9a]">{key}</div>
              <div className="num mt-0.5 text-[15px] font-extrabold" style={{ color: m?.hz != null ? "#b8e8f8" : "#3a5a78" }}>
                {m?.hz != null ? m.hz.toFixed(2) : "—"}
              </div>
              <div className="num text-[8px] text-[#4a6a88]">
                {m?.amp != null ? `amp ${m.amp}` : ""}
              </div>
              <div className="num text-[8px] text-[#4a6a88]">{age != null ? `${age}分前` : ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 観測ノート */}
      {live?.notes && (
        <div className="mt-4 px-3">
          <div className="rounded-xl border border-[#1a3048] bg-[#081220] px-3.5 py-3 text-[12px] leading-relaxed text-[#8ab8d0]">
            {live.notes}
          </div>
        </div>
      )}

      <p className="mt-4 px-4 text-center text-[9px] leading-relaxed text-[#3a5a78]">
        観測元: Tomsk (sos70.ru) / 5分ごとに自動更新
      </p>
    </main>
  );
}
