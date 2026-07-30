"use client";

import { useMemo, useState } from "react";
import {
  bestOf,
  moonOf,
  keyOf,
  todayKey,
  YOBI,
  SHISHI_COLOR,
  SHISHI_BG,
} from "@/lib/almanac";

/** 2025年12月〜2026年12月（冬至年） */
const MONTHS: Array<[number, number]> = [];
for (let i = 0; i < 13; i++) MONTHS.push([i === 0 ? 2025 : 2026, i === 0 ? 11 : i - 1]);
const MONTH_LABELS = [
  "2025年12月", "2026年1月", "2026年2月", "2026年3月", "2026年4月", "2026年5月",
  "2026年6月", "2026年7月", "2026年8月", "2026年9月", "2026年10月", "2026年11月", "2026年12月",
];

function accentOf(deg: number, level: number): string {
  if (level === 4) return SHISHI_COLOR[deg];
  if (level === 3) return "#8b6914";
  if (level === 2) return "#2a7a6a";
  return "#8a8070";
}

/** 手帳 — 361点の節分かれつ刻カレンダー。日をタップで詳細 */
export function TechoCalendar() {
  const today = todayKey();
  const initialMi = (() => {
    const now = new Date();
    const idx = MONTHS.findIndex(([y, m]) => y === now.getFullYear() && m === now.getMonth());
    return idx >= 0 ? idx : 7;
  })();
  const [mi, setMi] = useState(initialMi);
  const [selected, setSelected] = useState<string | null>(today);

  const weeks = useMemo(() => {
    const [y, m] = MONTHS[mi];
    const dim = new Date(y, m + 1, 0).getDate();
    const sd = new Date(y, m, 1).getDay();
    const rows: Array<Array<number | null>> = [];
    let wk: Array<number | null> = new Array(sd).fill(null);
    for (let d = 1; d <= dim; d++) {
      wk.push(d);
      if (wk.length === 7) {
        rows.push(wk);
        wk = [];
      }
    }
    if (wk.length) {
      while (wk.length < 7) wk.push(null);
      rows.push(wk);
    }
    return rows;
  }, [mi]);

  const [y, m] = MONTHS[mi];
  const sel = selected ? bestOf(selected) : null;
  const selMoon = selected ? moonOf(selected) : null;
  const selAc = sel ? accentOf(sel.deg, sel.level) : "#8a8070";

  return (
    <div>
      {/* 月ナビ */}
      <div className="flex items-center justify-between px-1 pb-1">
        <button
          onClick={() => mi > 0 && setMi(mi - 1)}
          aria-label="前の月"
          className="px-4 py-1 text-xl font-bold"
          style={{ color: mi === 0 ? "#ddd" : "#c94d3a" }}
        >
          ◀
        </button>
        <span className="text-base font-extrabold">{MONTH_LABELS[mi]}</span>
        <button
          onClick={() => mi < 12 && setMi(mi + 1)}
          aria-label="次の月"
          className="px-4 py-1 text-xl font-bold"
          style={{ color: mi === 12 ? "#ddd" : "#c94d3a" }}
        >
          ▶
        </button>
      </div>

      {/* 曜日 */}
      <div className="grid grid-cols-7 py-0.5">
        {YOBI.map((w, i) => (
          <div
            key={w}
            className="text-center text-[11px] font-semibold"
            style={{ color: i === 0 ? "#c05030" : i === 6 ? "#3070b0" : "#999" }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* グリッド */}
      <div className="border-t border-[#e8e0d2]">
        {weeks.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {wk.map((d, di) => {
              if (!d)
                return (
                  <div
                    key={di}
                    className="min-h-16 border-b border-[#e8e0d2] bg-[#f7f3ea]"
                    style={{ borderRight: di < 6 ? "1px solid #f0e9dc" : "none" }}
                  />
                );
              const k = keyOf(y, m + 1, d);
              const ev = bestOf(k);
              const mo = moonOf(k);
              const isToday = k === today;
              const level = ev?.level ?? 0;
              let bg = "#fffdf8";
              let dc = di === 0 ? "#c05030" : di === 6 ? "#3070b0" : "#3a3428";
              let label = "";
              let lc = "#888";
              if (ev && level === 4) {
                bg = SHISHI_BG[ev.deg];
                dc = SHISHI_COLOR[ev.deg];
                label = ev.sekki![0];
                lc = SHISHI_COLOR[ev.deg];
              } else if (ev && level === 3) {
                bg = "#fffbf0";
                dc = "#8b6914";
                label = ev.sekki![0];
                lc = "#8b6914";
              } else if (level === 2) {
                bg = "#f6fbf9";
              }
              if (isToday) bg = "#fff1eb";
              if (k === selected) bg = "#f0f6ff";
              return (
                <button
                  key={di}
                  onClick={() => setSelected(k)}
                  className="min-h-16 border-b border-[#e8e0d2] px-1 py-0.5 text-left"
                  style={{
                    background: bg,
                    borderRight: di < 6 ? "1px solid #f0e9dc" : "none",
                    boxShadow: isToday
                      ? "inset 0 0 0 2px #c94d3a"
                      : k === selected
                        ? "inset 0 0 0 2px #5080c0"
                        : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm leading-tight"
                      style={{ color: dc, fontWeight: level >= 3 ? 800 : 600 }}
                    >
                      {d}
                    </span>
                    <span className="text-[9px] opacity-85">{mo.emoji}</span>
                  </div>
                  {label && (
                    <div className="text-[8.5px] font-extrabold leading-tight" style={{ color: lc }}>
                      {label}
                    </div>
                  )}
                  {ev && (
                    <div
                      className="num text-[8.5px] leading-snug"
                      style={{ color: level >= 3 ? lc : "#a89e8c" }}
                    >
                      ☀{ev.time}
                    </div>
                  )}
                  {mo.holy && (
                    <div className="text-[7.5px] font-bold leading-tight text-[#b08030]">
                      ✦{mo.holy}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 選択日の詳細 */}
      {selected && (
        <div
          className="mt-3 rounded-xl border-2 p-3.5"
          style={{
            borderColor: `${selAc}35`,
            background: sel && sel.level === 4 ? SHISHI_BG[sel.deg] : "#faf8f2",
          }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold">
              {Number(selected.slice(5, 7))}月{Number(selected.slice(8, 10))}日
            </span>
            <span className="num text-[11px] text-[#b8a888]">
              {selMoon?.emoji} 旧暦{selMoon?.reki}
              {selMoon?.holy ? ` ✦${selMoon.holy}` : ""}
            </span>
          </div>
          {sel ? (
            <>
              <div className="num text-center text-3xl font-extrabold" style={{ color: selAc }}>
                {sel.time}
              </div>
              <div className="text-center text-[10.5px] tracking-widest text-[#a89e8c]">
                節分かれつ刻（黄経 {sel.deg}°）
              </div>
              {sel.sekki && (
                <div className="mt-2 border-t pt-2" style={{ borderColor: `${selAc}20` }}>
                  <span className="text-[16px] font-extrabold" style={{ color: selAc }}>
                    {sel.sekki[0]}
                  </span>
                  <span className="ml-2 text-xs text-[#999]">{sel.sekki[1]}</span>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#555]">{sel.sekki[2]}</p>
                </div>
              )}
              {sel.kou && (
                <div
                  className="mt-2 rounded-lg border-l-[3px] border-[#3a9a8a] bg-[#eef6f4] px-3 py-2"
                >
                  <span className="text-[13.5px] font-bold text-[#2a7a6a]">{sel.kou[0]}</span>
                  <span className="ml-2 text-[11px] text-[#5aaa9a]">{sel.kou[1]}</span>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#555]">{sel.kou[2]}</p>
                </div>
              )}
            </>
          ) : (
            <p className="py-2 text-center text-xs text-[#b0a898]">
              この日の節分かれつ刻はありません
            </p>
          )}
        </div>
      )}
    </div>
  );
}
