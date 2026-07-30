"use client";

import { useEffect, useRef, useState } from "react";
import {
  NodeEvent,
  eventsOfComputed,
  bestOfComputed,
  moonOf,
  keyOf,
  todayKey,
  YOBI,
  SHISHI_COLOR,
  SHISHI_BG,
} from "@/lib/almanac";
import { TideDay, fetchTideDay } from "@/lib/tide";

/**
 * 祈りの手帳 v2（InoriTechoV2.jsx を移植）。
 * - 節分かれつ刻: 天文計算（太陽視黄経・分単位）— どの年でも動く
 * - 月齢・聖点: 天文計算
 * - 潮汐: 気象庁239港（ツキヨガと共通データ）× 現在位置の最寄り港
 * - メモ・時間別予定は端末保存
 */

const SHISHI = new Set([0, 90, 180, 270]);

// 2025年12月〜2027年12月
const MONTHS: Array<[number, number]> = [];
const ML: string[] = [];
for (let y = 2025, m = 11; y < 2028; ) {
  MONTHS.push([y, m]);
  ML.push(`${y}年${m + 1}月`);
  m++;
  if (m > 11) {
    m = 0;
    y++;
  }
  if (y === 2027 && m === 0 && MONTHS.length > 25) break;
}

interface DayMemo {
  note: string;
  h: Record<string, string>;
}
type Memos = Record<string, DayMemo>;

function loadMemos(): Memos {
  try {
    const v = localStorage.getItem("techo-memos");
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

export function InoriTecho() {
  const now = new Date();
  const todayK = todayKey(now);
  const initialMi = (() => {
    const idx = MONTHS.findIndex(([y, m]) => y === now.getFullYear() && m === now.getMonth());
    return idx >= 0 ? idx : 0;
  })();
  const [mi, setMi] = useState(initialMi);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [memos, setMemos] = useState<Memos>({});

  useEffect(() => {
    setMemos(loadMemos());
  }, []);

  const saveMemo = (k: string, field: string, val: string) => {
    setMemos((prev) => {
      const day = prev[k] ?? { note: "", h: {} };
      let next: Memos;
      if (field === "note") next = { ...prev, [k]: { ...day, note: val } };
      else {
        const h = { ...day.h, [field]: val };
        if (!val) delete h[field];
        next = { ...prev, [k]: { ...day, h } };
      }
      const dd = next[k];
      if (!dd.note && Object.keys(dd.h ?? {}).length === 0) delete next[k];
      try {
        localStorage.setItem("techo-memos", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="relative overflow-hidden bg-white" style={{ margin: "0 -16px" }}>
      <MonthCal mi={mi} setMi={setMi} memos={memos} todayK={todayK} onOpenDay={setSheetKey} openKey={sheetKey} />
      {sheetKey && (
        <BottomSheet
          dk={sheetKey}
          memos={memos}
          onSave={saveMemo}
          onClose={() => setSheetKey(null)}
          onShift={(off) => {
            const [y, m, d] = sheetKey.split("-").map(Number);
            const nd = new Date(y, m - 1, d + off);
            setSheetKey(keyOf(nd.getFullYear(), nd.getMonth() + 1, nd.getDate()));
          }}
        />
      )}
    </div>
  );
}

/* ============ 月カレンダー ============ */
function MonthCal({
  mi,
  setMi,
  memos,
  todayK,
  onOpenDay,
  openKey,
}: {
  mi: number;
  setMi: (n: number) => void;
  memos: Memos;
  todayK: string;
  onOpenDay: (k: string) => void;
  openKey: string | null;
}) {
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const tr = useRef<{ sx: number; sy: number; locked: boolean; dir: string | null }>({
    sx: 0,
    sy: 0,
    locked: false,
    dir: null,
  });

  const [y, m] = MONTHS[mi];
  const dim = new Date(y, m + 1, 0).getDate();
  const sd = new Date(y, m, 1).getDay();
  const weeks: Array<Array<number | null>> = [];
  let wk: Array<number | null> = Array(sd).fill(null);
  for (let d = 1; d <= dim; d++) {
    wk.push(d);
    if (wk.length === 7) {
      weeks.push(wk);
      wk = [];
    }
  }
  if (wk.length) {
    while (wk.length < 7) wk.push(null);
    weeks.push(wk);
  }

  const onTS = (e: React.TouchEvent) => {
    tr.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, locked: false, dir: null };
    setSwiping(false);
    setDragX(0);
  };
  const onTM = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - tr.current.sx;
    const dy = t.clientY - tr.current.sy;
    if (!tr.current.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        tr.current.locked = true;
        tr.current.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      return;
    }
    if (tr.current.dir === "v") return;
    setSwiping(true);
    const maxD = window.innerWidth * 0.55;
    const ratio = Math.min(Math.abs(dx) / window.innerWidth, 1);
    setDragX(dx > 0 ? maxD * Math.pow(ratio, 0.72) : -maxD * Math.pow(ratio, 0.72));
  };
  const onTE = () => {
    if (!swiping) {
      setDragX(0);
      return;
    }
    const th = window.innerWidth * 0.2;
    if (dragX > th && mi > 0) {
      setDragX(window.innerWidth);
      setTimeout(() => {
        setMi(mi - 1);
        setDragX(0);
        setSwiping(false);
      }, 200);
    } else if (dragX < -th && mi < MONTHS.length - 1) {
      setDragX(-window.innerWidth);
      setTimeout(() => {
        setMi(mi + 1);
        setDragX(0);
        setSwiping(false);
      }, 200);
    } else {
      setDragX(0);
      setSwiping(false);
    }
  };

  const dk = (d: number) => keyOf(y, m + 1, d);
  const best = (d: number) => bestOfComputed(dk(d));

  return (
    <div className="min-h-[60vh] bg-white" onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      {/* 金の題字 */}
      <div className="px-4 py-2.5 text-center" style={{ background: "linear-gradient(135deg,#1a1208,#2a1a0a)" }}>
        <div className="text-[9px] tracking-[4px] text-[#a0906a]">太陽黄経三百六十等分</div>
        <div className="text-[18px] font-extrabold tracking-[3px] text-[#d4b96a]">祈りの手帳</div>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-between border-b border-[#eee] px-1.5 pb-0.5 pt-1.5">
        <button
          onClick={() => mi > 0 && setMi(mi - 1)}
          disabled={mi === 0}
          className="px-3.5 py-1 text-xl font-bold"
          style={{ color: mi === 0 ? "#ddd" : "#996b1d" }}
        >
          ◀
        </button>
        <span className="text-[17px] font-extrabold text-[#2a2a2a]">{ML[mi]}</span>
        <button
          onClick={() => mi < MONTHS.length - 1 && setMi(mi + 1)}
          disabled={mi === MONTHS.length - 1}
          className="px-3.5 py-1 text-xl font-bold"
          style={{ color: mi === MONTHS.length - 1 ? "#ddd" : "#996b1d" }}
        >
          ▶
        </button>
      </div>

      <div
        style={{
          transform: `translateX(${dragX}px)`,
          transition: swiping ? "none" : "transform 0.22s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="grid grid-cols-7 px-1 pb-0.5 pt-1">
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

        <div className="px-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7" style={{ borderTop: wi === 0 ? "1px solid #e8e4de" : "none" }}>
              {week.map((d, di) => {
                if (!d)
                  return (
                    <div
                      key={di}
                      className="border-b border-[#e8e4de] bg-[#fcfcfa]"
                      style={{ borderRight: di < 6 ? "1px solid #f0ede8" : "none" }}
                    />
                  );
                const k = dk(d);
                const ev = best(d);
                const isT = k === todayK;
                const l = ev?.level ?? 0;
                const moon = moonOf(k);
                const dayM = memos[k];
                const evCount = dayM ? Object.keys(dayM.h ?? {}).length : 0;
                const isOpen = k === openKey;

                let bg = "#fff";
                let dayC = di === 0 ? "#c05030" : di === 6 ? "#3070b0" : "#333";
                let label: string | null = null;
                let labelC = "#888";
                if (ev && l === 4) {
                  bg = SHISHI_BG[ev.deg];
                  dayC = SHISHI_COLOR[ev.deg];
                  label = ev.sekki![0];
                  labelC = SHISHI_COLOR[ev.deg];
                } else if (ev && l === 3) {
                  bg = "#fffbf2";
                  dayC = "#8b6914";
                  label = ev.sekki![0];
                  labelC = "#8b6914";
                } else if (l === 2) bg = "#f8fcfb";
                if (isT) bg = "#fff2ec";
                if (isOpen) bg = "#f0f6ff";

                return (
                  <div
                    key={di}
                    onClick={() => onOpenDay(k)}
                    className="relative cursor-pointer border-b border-[#e8e4de] px-1 py-0.5"
                    style={{
                      minHeight: 64,
                      background: bg,
                      borderRight: di < 6 ? "1px solid #f0ede8" : "none",
                      boxShadow: isT
                        ? "inset 0 0 0 2px #c05030"
                        : isOpen
                          ? "inset 0 0 0 2px #5080c0"
                          : "none",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm leading-tight" style={{ color: dayC, fontWeight: l >= 3 ? 800 : 600 }}>
                        {d}
                      </span>
                      <span className="text-[9px] opacity-85">{moon.emoji}</span>
                    </div>
                    {label && (
                      <div className="text-[8px] font-extrabold leading-tight" style={{ color: labelC }}>
                        {label}
                      </div>
                    )}
                    {ev && (
                      <div className="num text-[8.5px] leading-snug" style={{ color: l >= 3 ? labelC : "#a09880" }}>
                        ☀{ev.time}
                      </div>
                    )}
                    {moon.holy && <div className="text-[7px] font-bold leading-tight text-[#b08030]">✦{moon.holy}</div>}
                    {evCount > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-[1.5px]">
                        {Array.from({ length: Math.min(evCount, 4) }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-sm bg-[#7ba05b]"
                            style={{ width: evCount <= 2 ? 12 : 7, height: 3 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-3 py-2">
        {(
          [
            ["#996b1d", "四至"],
            ["#c09830", "節気"],
            ["#4a9a88", "候"],
            ["#7ba05b", "予定"],
          ] as const
        ).map(([c, lb]) => (
          <div key={lb} className="flex items-center gap-1">
            <div className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
            <span className="text-[9px] text-[#999]">{lb}</span>
          </div>
        ))}
      </div>
      <div className="pb-3 text-center text-[8px] text-[#ccc]">← スワイプで月を移動 →</div>
    </div>
  );
}

/* ============ ボトムシート（デイページ）============ */
function BottomSheet({
  dk,
  memos,
  onSave,
  onClose,
  onShift,
}: {
  dk: string;
  memos: Memos;
  onSave: (k: string, field: string, val: string) => void;
  onClose: () => void;
  onShift: (off: number) => void;
}) {
  const [y, m, d] = dk.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = YOBI[dt.getDay()];
  const evts = eventsOfComputed(dk);
  const best: NodeEvent | null = evts.length ? evts.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  const isSh = best && SHISHI.has(best.deg);
  const ac = isSh ? SHISHI_COLOR[best!.deg] : best?.level === 3 ? "#8b6914" : best?.level === 2 ? "#2a7a6a" : "#888";
  const moon = moonOf(dk);
  const dayMemo = memos[dk] ?? { note: "", h: {} };
  const [editH, setEditH] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tide, setTide] = useState<TideDay | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sheetY, setSheetY] = useState(0);
  const [draggingSheet, setDraggingSheet] = useState(false);
  const dragStart = useRef(0);

  const hTS = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
    setDraggingSheet(true);
  };
  const hTM = (e: React.TouchEvent) => {
    if (!draggingSheet) return;
    const dy = e.touches[0].clientY - dragStart.current;
    setSheetY(Math.max(-140, dy));
  };
  const hTE = () => {
    if (!draggingSheet) return;
    setDraggingSheet(false);
    if (sheetY > 90) {
      onClose();
      return;
    }
    if (sheetY < -60) setExpanded(true);
    else if (sheetY > 40 && expanded) setExpanded(false);
    setSheetY(0);
  };

  useEffect(() => {
    if (editH !== null && inputRef.current) inputRef.current.focus();
  }, [editH]);
  useEffect(() => {
    setEditH(null);
    setTide(null);
    fetchTideDay(dk).then(setTide);
  }, [dk]);

  const nodeH = best ? parseInt(best.time.split(":")[0]) : null;
  const nodeM = best ? parseInt(best.time.split(":")[1]) : null;

  const weekDays: Array<{ d: number; key: string; dow: string; diff: number }> = [];
  const wStart = new Date(y, m - 1, d - dt.getDay());
  for (let i = 0; i < 7; i++) {
    const wd = new Date(wStart);
    wd.setDate(wStart.getDate() + i);
    weekDays.push({
      d: wd.getDate(),
      key: keyOf(wd.getFullYear(), wd.getMonth() + 1, wd.getDate()),
      dow: YOBI[i],
      diff: Math.round((wd.getTime() - dt.getTime()) / 86400000),
    });
  }

  const tideRows: Array<[string, string, string]> = [];
  if (tide) {
    for (const [t] of tide.high) tideRows.push(["満", t, "#3070b0"]);
    for (const [t] of tide.low) tideRows.push(["干", t, "#88aacc"]);
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 mx-auto max-w-[480px]" style={{ background: "rgba(20,16,10,0.28)" }} />
      <div
        data-no-pull
        className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[480px] -translate-x-1/2 flex-col overflow-hidden bg-white"
        style={{
          height: expanded ? "92vh" : "58vh",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -6px 30px rgba(0,0,0,0.18)",
          transform: `translateY(${Math.max(0, sheetY)}px)`,
          transition: draggingSheet
            ? "none"
            : "height 0.28s cubic-bezier(0.22,1,0.36,1), transform 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* ハンドル */}
        <div
          onClick={() => setExpanded(!expanded)}
          onTouchStart={hTS}
          onTouchMove={hTM}
          onTouchEnd={hTE}
          className="flex-shrink-0 cursor-grab border-b border-[#f0ede6] pb-2 pt-2.5"
          style={{ background: "linear-gradient(180deg,#faf7f2,#fff)", touchAction: "none" }}
        >
          <div className="mx-auto mb-1 h-[5px] w-[60px] rounded bg-[#c8c0b2]" />
          <div className="text-center text-[9.5px] tracking-wider text-[#b0a898]">
            {expanded ? "▼ 下へスワイプで閉じる" : "▲ 上へスワイプで全画面"}
          </div>
        </div>

        {/* 週ストリップ */}
        <div className="grid flex-shrink-0 grid-cols-7 border-b border-[#efebe4] px-2 pb-1.5">
          {weekDays.map((wd, i) => {
            const isCur = wd.diff === 0;
            const ev = bestOfComputed(wd.key);
            const l = ev?.level ?? 0;
            return (
              <div
                key={i}
                onClick={() => wd.diff !== 0 && onShift(wd.diff)}
                className="cursor-pointer rounded-lg py-1 text-center"
                style={{ background: isCur ? "#fff3e0" : "transparent" }}
              >
                <div className="text-[9px]" style={{ color: i === 0 ? "#c05030" : i === 6 ? "#3070b0" : "#aaa" }}>
                  {wd.dow}
                </div>
                <div
                  className="text-[15px] leading-tight"
                  style={{ fontWeight: isCur ? 800 : 500, color: isCur ? "#c05030" : l >= 3 ? "#8b6914" : "#444" }}
                >
                  {wd.d}
                </div>
                {l >= 3 && (
                  <div
                    className="mx-auto mt-[1px] h-1 w-1 rounded-full"
                    style={{ background: l === 4 ? SHISHI_COLOR[ev!.deg] : "#c09830" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* 日付ヘッダー */}
          <div className="flex items-baseline justify-between px-4 pb-1.5 pt-2.5">
            <div>
              <span className="text-xl font-extrabold text-[#2a2a2a]">
                {m}月{d}日
              </span>
              <span className="ml-1.5 text-sm text-[#999]">（{dow}）</span>
            </div>
            <div className="text-[10px] text-[#b8a888]">旧暦{moon.reki}</div>
          </div>

          <div className="px-3.5">
            {/* 節分かれつ刻（天文計算） */}
            <div
              className="mb-2 rounded-xl p-3"
              style={{ background: best && isSh ? SHISHI_BG[best.deg] : "#fafaf6", border: `2px solid ${ac}35` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-widest text-[#999]">☀ 節分かれつ刻</span>
                <span className="text-[11px] text-[#bbb]">{best ? `${best.deg}°` : "—"}</span>
              </div>
              <div className="num text-center text-[32px] font-extrabold leading-tight" style={{ color: ac }}>
                {best ? best.time : "—"}
              </div>
              {best?.sekki && (
                <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: `${ac}20` }}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-extrabold" style={{ color: ac }}>
                      {best.sekki[0]}
                    </span>
                    <span className="text-xs text-[#999]">{best.sekki[1]}</span>
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-[#555]">{best.sekki[2]}</div>
                </div>
              )}
              {best?.kou && (
                <div className="mt-1.5 border-t border-[#3a9a8a25] pt-1.5">
                  <div className="text-[14.5px] font-bold text-[#2a7a6a]">{best.kou[0]}</div>
                  <div className="mt-[1px] text-[11.5px] text-[#5aaa9a]">{best.kou[1]}</div>
                  <div className="mt-1 rounded-lg border-l-[3px] border-[#3a9a8a] bg-[#eef6f4] px-2 py-1.5 text-[11.5px] leading-normal text-[#555]">
                    {best.kou[2]}
                  </div>
                </div>
              )}
            </div>

            {/* 潮汐＋月 */}
            <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "1.15fr 1fr" }}>
              <div className="rounded-xl border border-[#d8e4f0] bg-[#f4f8fc] p-2.5">
                <div className="mb-1 text-[9.5px] text-[#5080b0]">
                  🌊 潮汐 <span className="text-[#aab]">{tide ? `${tide.port}港` : "…"}</span>
                </div>
                {tide === null ? (
                  <div className="py-1 text-[10px] text-[#9ab]">現在位置から最寄り港を探しています...</div>
                ) : tideRows.length === 0 ? (
                  <div className="py-1 text-[10px] text-[#9ab]">この日のデータがありません</div>
                ) : (
                  <div className="text-[11px]">
                    {tideRows.map(([lb, t], i) => (
                      <div key={i} className="mb-[1.5px] flex justify-between">
                        <span style={{ color: lb === "満" ? "#3070b0" : "#80a8c8", fontWeight: lb === "満" ? 700 : 400 }}>
                          {lb}潮
                        </span>
                        <span className="num text-[#444]">{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[#e4dcc8] bg-[#faf8f4] p-2.5 text-center">
                <div className="text-[9.5px] text-[#a09060]">🌙 月</div>
                <div className="text-2xl leading-snug">{moon.emoji}</div>
                <div className="num text-[10.5px] text-[#7a6a4a]">月齢 {moon.age.toFixed(1)}</div>
                {moon.holy && <div className="mt-[1px] text-[10.5px] font-extrabold text-[#c09030]">✦{moon.holy}</div>}
              </div>
            </div>

            {/* メモ */}
            <textarea
              value={dayMemo.note}
              onChange={(e) => onSave(dk, "note", e.target.value)}
              placeholder="今日の祈り・気づき..."
              className="mb-2 w-full resize-y rounded-lg border border-[#e4e0d8] bg-[#fdfcfa] p-2 text-xs leading-normal text-[#333] outline-none"
              style={{ minHeight: 40 }}
            />

            {/* 24時間スケジュール */}
            <div className="mb-1 text-[10.5px] font-bold text-[#999]">📅 スケジュール</div>
            <div className="mb-4 overflow-hidden rounded-xl border border-[#e4e0d8]">
              {Array.from({ length: 24 }, (_, h) => {
                const isNode = nodeH === h;
                const nodePct = isNode && nodeM != null ? (nodeM / 60) * 100 : 0;
                const hNote = (dayMemo.h ?? {})[String(h)] ?? "";
                const isEd = editH === h;
                const marks = tideRows
                  .map(([lb, t, c]) => {
                    const th = parseInt(t.split(":")[0]);
                    const tm = parseInt(t.split(":")[1]);
                    return th === h ? { lb, min: tm, color: c } : null;
                  })
                  .filter(Boolean) as Array<{ lb: string; min: number; color: string }>;
                return (
                  <div
                    key={h}
                    onClick={() => {
                      if (!isEd) setEditH(h);
                    }}
                    className="flex cursor-text"
                    style={{
                      minHeight: hNote || isEd ? 40 : 28,
                      borderBottom: h < 23 ? "1px solid #f2efea" : "none",
                      background: isNode ? "#fff8ee" : isEd ? "#fafdf8" : "#fff",
                    }}
                  >
                    <div
                      className="num flex-shrink-0 border-r border-[#eeeae4] pr-1.5 pt-1.5 text-right text-[10px]"
                      style={{ width: 34, color: isNode ? ac : "#c4c0b8", fontWeight: isNode ? 700 : 400 }}
                    >
                      {h}:00
                    </div>
                    <div className="relative flex flex-1 items-center">
                      {hNote && !isEd && (
                        <div className="absolute bottom-1 left-0 top-1 w-[3px] rounded bg-[#7ba05b]" />
                      )}
                      {isNode && best && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-[2] h-[2px]"
                          style={{ top: `${nodePct}%`, background: ac }}
                        >
                          <span
                            className="absolute right-1 rounded px-1 text-[8px] font-bold"
                            style={{ top: -7, color: ac, background: isEd ? "#fafdf8" : "#fff8ee" }}
                          >
                            ☀{best.time}
                          </span>
                        </div>
                      )}
                      {marks.map((tm, i) => (
                        <div
                          key={i}
                          className="pointer-events-none absolute left-0 right-0 z-[1] h-[1.5px] opacity-40"
                          style={{ top: `${(tm.min / 60) * 100}%`, background: tm.color }}
                        >
                          <span
                            className="absolute left-1 rounded bg-white px-0.5 text-[7px] font-semibold"
                            style={{ top: -6, color: tm.color }}
                          >
                            🌊{tm.lb}
                          </span>
                        </div>
                      ))}
                      {isEd ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={hNote}
                          onChange={(e) => onSave(dk, String(h), e.target.value)}
                          onBlur={() => setEditH(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setEditH(h < 23 ? h + 1 : null);
                            }
                          }}
                          placeholder="予定..."
                          className="w-full bg-transparent px-2 py-1 text-xs text-[#333] outline-none"
                        />
                      ) : (
                        <div className="w-full px-2 py-1 text-xs" style={{ color: hNote ? "#333" : "transparent", minHeight: 17 }}>
                          {hNote || "."}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
