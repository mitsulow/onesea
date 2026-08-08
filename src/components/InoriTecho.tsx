"use client";

import { readTecho, writeTecho, setCurrentUid, migrateLegacyTecho } from "@/lib/techoStore";
import { useEffect, useRef, useState } from "react";
import {
  NodeEvent,
  eventsOfComputed,
  bestOfComputed,
  moonOf,
  moonTimesOf,
  moonImageOf,
  kyurekiLabel,
  holyTimeOf,
  kyurekiFullLabel,
  moonNameOf,
  keyOf,
  todayKey,
  YOBI,
  SHISHI_COLOR,
  SHISHI_BG,
} from "@/lib/almanac";
import { TideDay, Port, fetchTideDay, listPorts, setChosenPort, clearPositionCache } from "@/lib/tide";
import { createClient } from "@/lib/supabase/client";
import { scheduleTechoBackup, restoreTechoIfEmpty } from "@/lib/techoBackup";
import { ensureAlarmPermission, startAlarmWatcher } from "@/lib/techoAlarm";
import { hasConsent } from "@/lib/consents";
import { ConsentDialog } from "@/components/ConsentDialog";
import { SignupDialog } from "@/components/SignupDialog";

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

export interface TechoEv {
  id: string;
  alarm?: boolean; // アラーム(通知)を鳴らす
  sh: number; // 開始 時
  sm: number; // 開始 分
  eh: number; // 終了 時
  em: number; // 終了 分
  text: string;
  color: string; // ペンID
}

interface DayMemo {
  note: string;
  h: Record<string, string>;
  ev?: TechoEv[];
}
type Memos = Record<string, DayMemo>;

/** 色ペン（仕事は赤・遊びは青…） */
export const PENS = [
  { id: "red", c: "#d04030", label: "仕事" },
  { id: "blue", c: "#3070c0", label: "遊び" },
  { id: "green", c: "#4a9a5a", label: "暮らし" },
  { id: "gold", c: "#c09030", label: "大事" },
  { id: "gray", c: "#707070", label: "その他" },
] as const;
export const penColor = (id: string) => PENS.find((x) => x.id === id)?.c ?? "#4a9a5a";

/** ペンのタグ名（ユーザーが自由に変えられる。localStorage保存） */
export function loadPenLabels(): Record<string, string> {
  const base: Record<string, string> = {};
  for (const pn of PENS) base[pn.id] = pn.label;
  try {
    const v = JSON.parse(localStorage.getItem("techo-pens") ?? "{}");
    return { ...base, ...v };
  } catch {
    return base;
  }
}
export function savePenLabels(labels: Record<string, string>) {
  try {
    localStorage.setItem("techo-pens", JSON.stringify(labels));
  } catch {}
}

function loadMemos(): Memos {
  try {
    return JSON.parse(readTecho());
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
  // ゲストは眺めるだけ。書き込み（日シートを開く）は無料会員から
  const loggedIn = useRef<boolean | null>(null);
  const uidRef = useRef<string | null>(null);
  const [waraCloud, setWaraCloud] = useState<"warawa" | "free" | null>(null); // バックアップ表示用
  const [showSignup, setShowSignup] = useState(false);
  const consentOk = useRef<boolean | null>(null); // 初回書き込み前の法的同意
  const [consentDlg, setConsentDlg] = useState(false);
  const [fsCal, setFsCal] = useState(false); // 全画面カレンダー
  const pendingOpen = useRef<string | null>(null);

  useEffect(() => {
    setMemos(loadMemos());
    startAlarmWatcher(); // アラーム付き予定の見張り
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      loggedIn.current = !!session?.user;
      const u = session?.user;
      setCurrentUid(u?.id ?? null);
      migrateLegacyTecho(); // 旧・端末共通キーからの一回きり引っ越し
      setMemos(loadMemos()); // uid確定後のキーで読み直す
      if (!u) return;
      uidRef.current = u.id;
      hasConsent(u.id, "techo").then((v) => { consentOk.current = v; });
      const { data: prof } = await supabase.from("profiles").select("warawa_until").eq("id", u.id).maybeSingle();
      const wara = !!prof?.warawa_until && new Date(prof.warawa_until as string) > new Date();
      setWaraCloud(wara ? "warawa" : "free");
      if (wara) {
        // 機種変更後の新端末: ローカルが空ならクラウドから予定を復元
        const restored = await restoreTechoIfEmpty(u.id);
        if (restored) setMemos(loadMemos());
      }
    });
  }, []);

  const tryOpenDay = (k: string | null) => {
    if (k !== null && loggedIn.current === false) {
      setShowSignup(true);
      return;
    }
    // 初回だけ: データ消失の了承を取ってから書き込み開始
    if (k !== null && uidRef.current && consentOk.current === false) {
      pendingOpen.current = k;
      setConsentDlg(true);
      return;
    }
    setSheetKey(k);
  };

  // ダッシュボードや手帳アイコンから「今日」を直接開く
  useEffect(() => {
    const f = () => {
      if (loggedIn.current === false) {
        setShowSignup(true);
        return;
      }
      setMemos(loadMemos());
      setSheetKey(todayK);
    };
    window.addEventListener("onesea:openToday", f);
    // ダッシュボードの予定スワイプから「その日」を直接開く
    const g = (e: Event) => {
      const k = (e as CustomEvent).detail;
      if (typeof k !== "string") return;
      if (loggedIn.current === false) {
        setShowSignup(true);
        return;
      }
      setMemos(loadMemos());
      setSheetKey(k);
    };
    window.addEventListener("onesea:openDay", g);
    return () => {
      window.removeEventListener("onesea:openToday", f);
      window.removeEventListener("onesea:openDay", g);
    };
  }, [todayK]);

  const saveEvents = (k: string, evs: TechoEv[]) => {
    setMemos((prev) => {
      const day = prev[k] ?? { note: "", h: {} };
      const next: Memos = { ...prev, [k]: { ...day, ev: evs } };
      const dd = next[k];
      if (!dd.note && Object.keys(dd.h ?? {}).length === 0 && (dd.ev ?? []).length === 0) delete next[k];
      try {
        writeTecho(JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event("onesea:techoChanged")); // トップの「次の予定」を即同期
      if (uidRef.current && waraCloud === "warawa") scheduleTechoBackup(uidRef.current);
      return next;
    });
  };

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
        writeTecho(JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event("onesea:techoChanged")); // トップの「次の予定」を即同期
      if (uidRef.current && waraCloud === "warawa") scheduleTechoBackup(uidRef.current);
      return next;
    });
  };

  return (
    <div className="relative overflow-hidden bg-white" style={{ margin: "0 -16px" }}>
      <SignupDialog open={showSignup} onClose={() => setShowSignup(false)} feature="手帳に書き込めるように" />
      {consentDlg && uidRef.current && (
        <ConsentDialog
          kind="techo"
          userId={uidRef.current}
          onAgreed={() => {
            consentOk.current = true;
            setConsentDlg(false);
            if (pendingOpen.current) setSheetKey(pendingOpen.current);
            pendingOpen.current = null;
          }}
          onClose={() => setConsentDlg(false)}
        />
      )}
      <MonthCal mi={mi} setMi={setMi} memos={memos} todayK={todayK} onOpenDay={tryOpenDay} openKey={sheetKey} waraCloud={waraCloud} onFullscreen={() => setFsCal(true)} />
      {fsCal && (
        <FullscreenCal
          mi={mi}
          setMi={setMi}
          memos={memos}
          todayK={todayK}
          onClose={() => setFsCal(false)}
          onOpenDay={(k) => {
            setFsCal(false);
            tryOpenDay(k);
          }}
        />
      )}
      {sheetKey && (
        <BottomSheet
          dk={sheetKey}
          onSaveEv={saveEvents}
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
  waraCloud,
  onFullscreen,
}: {
  mi: number;
  setMi: (n: number) => void;
  memos: Memos;
  todayK: string;
  onOpenDay: (k: string) => void;
  openKey: string | null;
  waraCloud: "warawa" | "free" | null;
  onFullscreen?: () => void;
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
    <div className="bg-white" onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      {/* 金の題字 */}
      <div className="px-4 pt-1" style={{ background: "#fff" }}>
      </div>

      {/* 月ナビ — ⛶全画面は「8月」と▶のちょうど中間 */}
      <div className="flex items-center border-b border-[#eee] px-1.5 py-0.5">
        <button
          onClick={() => mi > 0 && setMi(mi - 1)}
          disabled={mi === 0}
          className="px-3.5 py-0.5 text-xl font-bold"
          style={{ color: mi === 0 ? "#ddd" : "#996b1d" }}
        >
          ◀
        </button>
        <div className="flex-1" />
        <span className="text-[17px] font-extrabold text-[#2a2a2a]">{ML[mi]}</span>
        <div className="flex flex-1 justify-center">
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="flex items-center gap-[3px] rounded-md border border-[#e0d8c8] bg-white px-1.5 py-[3px] text-[9px] font-bold leading-none text-[#8a7a5a]"
            >
              <span className="text-[11px] leading-none">⛶</span> 全画面表示
            </button>
          )}
        </div>
        <button
          onClick={() => mi < MONTHS.length - 1 && setMi(mi + 1)}
          disabled={mi === MONTHS.length - 1}
          className="px-3.5 py-0.5 text-xl font-bold"
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

      {waraCloud === "free" && (
        <a href="/lp/onesea" className="block bg-white pb-1 pt-0.5 text-center text-[9.5px] font-bold text-[#c94d3a] no-underline">
          ☁ わらわ〜会員は予定を自動バックアップ — 機種変更しても消えません →
        </a>
      )}
    </div>
  );
}

/* ============ ボトムシート（デイページ）============ */
function BottomSheet({
  dk,
  memos,
  onSave,
  onSaveEv,
  onClose,
  onShift,
}: {
  dk: string;
  memos: Memos;
  onSave: (k: string, field: string, val: string) => void;
  onSaveEv: (k: string, evs: TechoEv[]) => void;
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [tide, setTide] = useState<TideDay | null>(null);
  const [evEdit, setEvEdit] = useState<TechoEv | null>(null); // 編集中の予定（id空なら新規）
  const [portPick, setPortPick] = useState(false); // 港選択モーダル
  const [celSel, setCelSel] = useState<"sun" | "earth" | "moon" | null>(null); // 天体トリオの選択
  const [celSeen, setCelSeen] = useState<Set<string>>(new Set()); // 既読(バッジ消し)
  const [penLabels, setPenLabels] = useState<Record<string, string>>({});
  const [penEdit, setPenEdit] = useState(false);
  useEffect(() => setPenLabels(loadPenLabels()), []);
  const [ports, setPorts] = useState<Port[]>([]);
  const [portQ, setPortQ] = useState("");
  const [expanded, setExpanded] = useState(true); // 最初から全画面
  const dayEvs: TechoEv[] = dayMemo.ev ?? [];
  // 月の出・南中・月の入り（現在位置キャッシュがあればその場所で）
  const mt = (() => {
    try {
      const pos = JSON.parse(localStorage.getItem("onesea-pos") ?? "null");
      return moonTimesOf(dk, pos?.lat ?? 35.68, pos?.lon ?? 139.76);
    } catch {
      return moonTimesOf(dk);
    }
  })();
  const [sheetY, setSheetY] = useState(0);
  const [draggingSheet, setDraggingSheet] = useState(false);
  const dragStart = useRef(0);
  /* 左右スワイプで前日/翌日（画面を実際に引っ張る手応え付き） */
  const [hx, setHx] = useState(0);
  const [hDragging, setHDragging] = useState(false);
  const hRef = useRef<{ sx: number; sy: number; locked: boolean; dir: string | null }>({
    sx: 0,
    sy: 0,
    locked: false,
    dir: null,
  });

  const sTS = (e: React.TouchEvent) => {
    hRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, locked: false, dir: null };
  };
  const sTM = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    const dx = t0.clientX - hRef.current.sx;
    const dy = t0.clientY - hRef.current.sy;
    if (!hRef.current.locked) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        hRef.current.locked = true;
        hRef.current.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? "h" : "v";
        if (hRef.current.dir === "h") setHDragging(true);
      }
      return;
    }
    if (hRef.current.dir !== "h") return;
    const maxD = window.innerWidth * 0.6; // 画面の途中まで実際に引っ張れる
    const ratio = Math.min(Math.abs(dx) / window.innerWidth, 1);
    setHx((dx > 0 ? 1 : -1) * maxD * Math.pow(ratio, 0.78));
  };
  const slideTo = (target: number, off: number) => {
    setHx(target);
    setTimeout(() => {
      onShift(off);
      setHDragging(true); // transition を切って反対側へ瞬間移動
      setHx(-target);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setHDragging(false);
          setHx(0); // 新しい日がスライドイン
        })
      );
    }, 190);
  };
  const sTE = () => {
    if (hRef.current.dir !== "h") return;
    setHDragging(false);
    const th = window.innerWidth * 0.17;
    if (hx > th) slideTo(window.innerWidth * 0.62, -1);
    else if (hx < -th) slideTo(-window.innerWidth * 0.62, 1);
    else setHx(0);
  };

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
    for (const [t] of tide.high) tideRows.push(["満", t, "#0a7ac0"]);
    for (const [t] of tide.low) tideRows.push(["干", t, "#b8862a"]);
    // 新聞式の「満満干干」ではなく、起こる時間順に並べる
    tideRows.sort((a, b) => a[1].localeCompare(b[1]));
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 mx-auto max-w-[480px] md:max-w-[820px] lg:max-w-[1080px]" style={{ background: "rgba(20,16,10,0.28)" }} />
      <div
        data-no-pull
        onTouchStart={sTS}
        onTouchMove={sTM}
        onTouchEnd={sTE}
        className="fixed inset-y-0 left-1/2 z-[80] flex w-full max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] flex-col overflow-hidden bg-white"
        style={{
          transform: `translateX(calc(-50% + ${hx}px))`,
          transition: hDragging ? "none" : "transform 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}
      >


        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 16 }}>
          {/* 日付ヘッダー（独立バー・センター日付・右上×） */}
          <div
            className="relative border-b border-[#f0ede6] px-4 pb-2 text-center"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", background: "linear-gradient(180deg,#faf7f2,#fff)" }}
          >
            <div className="text-center text-[24px] font-extrabold leading-tight text-[#2a2a2a]">
              {m}月{d}日<span className="text-[0.78em]">({dow})</span>
            </div>
            <div className="-mt-0.5 text-[10px] leading-tight text-[#b8a888]">{kyurekiLabel(dk)}</div>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#f0ece4] text-[16px] text-[#8a8070]"
              style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
            >
              ×
            </button>
          </div>

          <div className="px-3.5">
            {/* ★天体トリオ v2 — 白バックに浮かぶ3つの星。未読①バッジがタップを誘う */}
            <style>{`
              @keyframes celFloat { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-5px); } }
            `}</style>
            <div className="-mx-3.5 mb-2 border-y border-[#efe8da] bg-white">
              <div className="flex items-end justify-center gap-10 px-3 pb-3 pt-4">
                {(() => {
                  const holyT = holyTimeOf(dk);
                  const items = [
                    { key: "sun" as const, src: "/icons/cel-sun.png", size: 46, glow: "rgba(255,180,40,.55)", delay: "0s", badge: 1 + (best?.sekki ? 1 : 0) },
                    { key: "earth" as const, src: "/icons/cel-earth.png", size: 58, glow: "rgba(70,150,240,.45)", delay: "1.3s", badge: Math.min(9, tideRows.length) },
                    { key: "moon" as const, src: "/icons/cel-moon.png", size: 46, glow: "rgba(200,170,60,.5)", delay: "2.6s", badge: 1 + (holyT ? 1 : 0) },
                  ];
                  return items.map(({ key, src, size, glow, delay, badge }) => {
                    const on = celSel === key;
                    const seen = celSeen.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setCelSel(on ? null : key);
                          setCelSeen((prev) => new Set(prev).add(key));
                        }}
                        className="relative"
                        style={{ animation: `celFloat 4.5s ease-in-out ${delay} infinite` }}
                      >
                        <span
                          className="block rounded-full transition-all duration-300"
                          style={{
                            padding: 3,
                            border: on ? `2px solid ${glow}` : "2px solid transparent",
                            filter: `drop-shadow(0 ${on ? 4 : 2}px ${on ? 14 : 8}px ${glow})`,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="rounded-full object-contain" style={{ width: size, height: size }} loading="lazy" />
                        </span>
                        {!seen && badge > 0 && (
                          <span className="absolute -right-1 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[10px] font-bold text-white" style={{ lineHeight: 1 }}>
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* ── 太陽: 叶いタイム ── */}
              {celSel === "sun" && (
                <div className="mx-2 mb-2 rounded-xl p-3" style={{ background: best && isSh ? SHISHI_BG[best.deg] : "#fdf3e4", border: `2px solid ${ac}35` }}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="tracking-widest text-[#b07a30]">叶いタイム</span>
                    <span className="mx-2 flex-1 border-b border-dotted border-[#d8c9a0]" style={{ transform: "translateY(-3px)" }} />
                    <span className="num font-extrabold" style={{ color: "#0a9a52" }}>{best ? best.time : "—"}</span>
                  </div>
                  {(() => {
                    const dg = best?.deg;
                    const lv = dg == null ? 1
                      : dg === 270 ? 360 : dg === 90 ? 180
                      : dg === 0 || dg === 180 ? 90
                      : [45, 135, 225, 315].includes(dg) ? 45
                      : dg % 15 === 0 ? 15 : dg % 5 === 0 ? 5 : 1;
                    const c = lv >= 180 ? "#c9002a" : lv >= 90 ? "#c94d3a" : lv >= 45 ? "#e07020" : "#a08c50";
                    const word = lv === 360 ? "最強" : lv === 180 ? "超すごい" : lv === 90 ? "凄い" : lv === 45 ? "かなり強い" : lv === 15 ? "強い" : lv === 5 ? "少し強い" : "普通";
                    return (
                      <div className="text-right">
                        <span className="num text-[11px] font-extrabold" style={{ color: c }}>
                          叶いレベル{lv}（{word}）
                        </span>
                      </div>
                    );
                  })()}
                  {best?.sekki && (
                    <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: `${ac}20` }}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold" style={{ color: ac }}>{best.sekki[0]}</span>
                        <span className="text-xs text-[#999]">{best.sekki[1]}</span>
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[#555]">{best.sekki[2]}</div>
                    </div>
                  )}
                  {best?.kou && (
                    <div className="mt-1.5 border-t border-[#3a9a8a25] pt-1.5">
                      <div className="text-[14.5px] font-bold text-[#2a7a6a]">{best.kou[0]}</div>
                      <div className="mt-[1px] text-[11.5px] text-[#5aaa9a]">{best.kou[1]}</div>
                      <div className="mt-1 rounded-lg border-l-[3px] border-[#3a9a8a] bg-[#eef6f4] px-2 py-1.5 text-[11.5px] leading-normal text-[#555]">{best.kou[2]}</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 地球: 潮 ── */}
              {celSel === "earth" && (
                <div className="mx-2 mb-2 rounded-xl border border-[#d8e4f0] bg-[#f4f8fc] p-2.5">
                  <button
                    onClick={async () => {
                      setPortPick(true);
                      if (!ports.length) setPorts(await listPorts());
                    }}
                    className="mb-1 rounded-full border border-[#c8d8e8] bg-white px-2 py-0.5 text-[10px] font-bold text-[#3070b0]"
                  >
                    <img src="/icons/icon-anchor.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> {tide ? `${tide.port}港` : "港を選ぶ"} ▾
                  </button>
                  {tide === null ? (
                    <div className="py-1 text-[10px] text-[#9ab]">現在位置から最寄り港を探しています...</div>
                  ) : tideRows.length === 0 ? (
                    <div className="py-1 text-[10px] text-[#9ab]">この日のデータがありません</div>
                  ) : (
                    <div className="text-[12px]">
                      {tideRows.map(([lb, t], i) => (
                        <div key={i} className="mb-[1.5px] flex justify-between">
                          <span style={{ color: lb === "満" ? "#3070b0" : "#80a8c8", fontWeight: lb === "満" ? 700 : 400 }}>{lb}潮</span>
                          <span className="num text-[#444]">{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 月: 月齢と出入り ── */}
              {celSel === "moon" && (
                <div className="relative mx-2 mb-2 overflow-hidden rounded-xl border border-[#26262e]" style={{ background: "#000005", height: 200 }}>
                  {/* NASA月画像を上下いっぱいにドーンと */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={moonImageOf(moon.age)}
                    alt=""
                    loading="lazy"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain"
                    style={{ height: 188, width: 188 }}
                  />
                  {/* 左上: 月齢(大きめ) + 朔弦望メッセージ */}
                  <div className="absolute left-3 top-2.5 z-10 text-left" style={{ textShadow: "0 0 6px #000" }}>
                    <div className="num text-[16px] font-bold text-[#e8e4f0]">月齢 {moon.age.toFixed(1)}</div>
                    <div className="mt-0.5 text-[11px] leading-tight text-[#b8b4c8]">{kyurekiFullLabel(dk)}</div>
                    {(() => {
                      const mn = moonNameOf(dk);
                      return (
                        <div className="mt-0.5 text-[13px] font-extrabold leading-tight text-[#c8d8f0]">
                          {mn.yomi}<span className="ml-1 text-[10px] font-normal text-[#8a90a8]">（{mn.kanji}）</span>
                        </div>
                      );
                    })()}
                  </div>
                  {/* 右上: 朔弦望メッセージ（右詰め・✦なし） */}
                  {(() => {
                    const ht = holyTimeOf(dk);
                    return ht ? (
                      <div className="absolute right-3 top-2.5 z-10 text-right text-[13px] font-extrabold leading-snug text-[#e8c860]" style={{ textShadow: "0 0 6px #000" }}>
                        {ht.name}（{ht.label}）
                        <br />
                        <span className="num">{ht.time}</span>
                      </div>
                    ) : null;
                  })()}
                  {/* 右下: 月の出・南中・月の入 */}
                  <div className="absolute bottom-2.5 right-3 z-10 text-right text-[11px] leading-relaxed text-[#b8b4c8]" style={{ textShadow: "0 0 6px #000" }}>
                    <div>月の出 <span className="num text-white">{mt.rise ?? "—"}</span></div>
                    <div>南中 <span className="num text-white">{mt.transit ?? "—"}</span></div>
                    <div>月の入 <span className="num text-white">{mt.set ?? "—"}</span></div>
                  </div>
                </div>
              )}
            </div>


            {/* 24時間スケジュール */}
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-[#999]"><img src="/icons/icon-calendar.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> スケジュール</span>
              {/* ＋ 予定を追加 — 開始時刻〜終了時刻を選んで入れる（一般的な手帳アプリと同じ） */}
              <button
                onClick={() => {
                  const nh = Math.min(23, new Date().getHours() + 1);
                  setEvEdit({ id: "", sh: nh, sm: 0, eh: Math.min(23, nh + 1), em: nh >= 22 ? 59 : 0, text: "", color: "green" });
                }}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white"
                style={{ background: "#c94d3a" }}
              >
                <span className="text-[13px] leading-none">＋</span> 予定を追加
              </button>
            </div>
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
                const evsHere = dayEvs.filter((ev) => ev.sh <= h && (ev.eh > h || (ev.eh === h && ev.em > 0) || ev.eh === ev.sh));
                const starters = evsHere.filter((ev) => ev.sh === h);
                const passers = evsHere.filter((ev) => ev.sh !== h);
                return (
                  <div
                    key={h}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-ev]")) return;
                      if (isEd) return;
                      setEditH(h); // タップ=その場で直接書く（第一の入力方法・緑メモ）
                    }}
                    className="flex cursor-pointer"
                    style={{
                      minHeight: hNote || isEd || starters.length ? 40 : 28,
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
                      {/* 時間範囲の継続バー（開始時以外の時間帯） */}
                      {passers.map((ev, i) => (
                        <div
                          key={ev.id}
                          data-ev
                          onClick={() => setEvEdit(ev)}
                          className="absolute bottom-0 top-0 w-[4px] cursor-pointer rounded"
                          style={{ left: 1 + i * 6, background: penColor(ev.color), opacity: 0.55 }}
                        />
                      ))}
                      {hNote && !isEd && (
                        <div className="absolute bottom-1 left-0 top-1 w-[3px] rounded bg-[#7ba05b]" />
                      )}
                      {isNode && best && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-[2] h-[2px]"
                          style={{ top: `${nodePct}%`, background: ac }}
                        >
                          <span
                            className="absolute left-1 rounded px-0.5 text-[8px] font-bold"
                            style={{ top: -7, color: ac, background: isEd ? "#fafdf8" : "#fff8ee" }}
                          >
                            叶い
                          </span>
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
                          className="pointer-events-none absolute left-0 right-0 z-[1] h-[1.5px] opacity-55"
                          style={{ top: `${(tm.min / 60) * 100}%`, background: tm.color }}
                        >
                          <span
                            className="absolute left-1 rounded bg-white px-0.5 text-[8px] font-bold"
                            style={{ top: -6, color: tm.color }}
                          >
                            🌊{tm.lb}潮
                          </span>
                        </div>
                      ))}
                      {/* 各時間の＋は廃止（上の「予定を追加」で足りる）。
                          空欄の長押し/タップ書き込みはそのまま残す。 */}
                      {isEd ? (
                        <textarea
                          ref={inputRef}
                          value={hNote}
                          onChange={(e) => onSave(dk, String(h), e.target.value)}
                          onBlur={() => setEditH(null)}
                          placeholder={"予定...（改行で2件目もOK）"}
                          rows={Math.max(2, hNote.split("\n").length)}
                          className="w-full resize-none bg-transparent px-2 py-1 text-xs leading-relaxed text-[#333] outline-none"
                        />
                      ) : (
                        <div className="w-full py-1 pl-2 pr-8" style={{ paddingLeft: passers.length ? 2 + passers.length * 6 + 6 : 8 }}>
                          {starters.map((ev) => (
                            <button
                              key={ev.id}
                              data-ev
                              onClick={() => setEvEdit(ev)}
                              className="mb-0.5 block w-full rounded-md px-1.5 py-0.5 text-left text-[11px] leading-snug"
                              style={{
                                background: penColor(ev.color) + "18",
                                borderLeft: `3px solid ${penColor(ev.color)}`,
                                color: "#333",
                              }}
                            >
                              <span className="num font-bold" style={{ color: penColor(ev.color) }}>
                                {String(ev.sh).padStart(2, "0")}:{String(ev.sm).padStart(2, "0")}〜{String(ev.eh).padStart(2, "0")}:{String(ev.em).padStart(2, "0")}
                              </span>{" "}
                              {ev.text}
                            </button>
                          ))}
                          {hNote && (
                            <div className="whitespace-pre-wrap text-xs leading-relaxed text-[#333]">{hNote}</div>
                          )}
                          {!hNote && starters.length === 0 && <div className="text-xs" style={{ color: "transparent", minHeight: 17 }}>.</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 週ストリップ（下側） */}
        <div
          className="grid flex-shrink-0 grid-cols-7 border-t border-[#efebe4] px-2 pt-1.5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 60px)" }}
        >
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
      </div>

      {/* 港選択（ツキヨガと同じ: 一覧から選ぶ・検索つき） */}
      {portPick && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40" onClick={() => setPortPick(false)}>
          <div
            className="flex w-full max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] flex-col rounded-t-2xl bg-white"
            style={{ height: "70dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#eee] px-4 py-3">
              <div className="mb-2 text-center text-[13px] font-extrabold text-[#3070b0]"><img src="/icons/icon-anchor.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -2.5 }} /> 港をえらぶ</div>
              <input
                value={portQ}
                onChange={(e) => setPortQ(e.target.value)}
                placeholder="港名でさがす（例: 那覇）"
                className="w-full rounded-xl border border-[#dde] bg-[#f8fafc] px-3 py-2 text-[13px] outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <button
                onClick={() => {
                  setChosenPort(null);
                  clearPositionCache(); // 古い位置キャッシュを捨てて、いま居る場所で取り直す
                  setPortPick(false);
                  setTide(null);
                  fetchTideDay(dk).then(setTide);
                }}
                className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-bold text-[#3070b0]"
              >
                <img src="/icons/icon-pin.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> いまの現在位置から最寄り港をえらぶ
              </button>
              {ports
                .filter((pt) => !portQ.trim() || pt.name.includes(portQ.trim()))
                .map((pt) => (
                  <button
                    key={pt.code}
                    onClick={() => {
                      setChosenPort(pt.code);
                      setPortPick(false);
                      setTide(null);
                      fetchTideDay(dk).then(setTide);
                    }}
                    className="w-full border-t border-[#f4f4f0] px-3 py-2.5 text-left text-[13px] text-[#333]"
                  >
                    {pt.name}
                  </button>
                ))}
            </div>
            <div className="border-t border-[#eee] p-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
              <button onClick={() => setPortPick(false)} className="w-full rounded-xl py-2.5 text-[13px] font-bold text-[#999]">
                とじる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予定の追加・編集（○時○分〜○時○分・色ペン） */}
      {evEdit && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40" onClick={() => setEvEdit(null)}>
          <div
            className="w-full max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#ddd]" />
            <input
              value={evEdit.text}
              onChange={(e) => setEvEdit({ ...evEdit, text: e.target.value })}
              placeholder="予定の内容..."
              autoFocus={!evEdit.id}
              className="w-full rounded-xl border border-[#e4e0d8] bg-[#fdfcfa] px-3 py-2.5 text-[14px] outline-none focus:border-[#c94d3a]"
            />
            <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[#555]">
              <select
                value={evEdit.sh}
                onChange={(e) => {
                  const sh = Number(e.target.value);
                  // 開始を選んだら終了は自動で1時間後に（過去にはならない。あとで自由に直せる）
                  setEvEdit({ ...evEdit, sh, eh: Math.min(23, sh + 1), em: evEdit.sm });
                }}
                className="rounded-lg border border-[#e4e0d8] bg-white px-1.5 py-1.5"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}時</option>
                ))}
              </select>
              <select
                value={evEdit.sm}
                onChange={(e) => setEvEdit({ ...evEdit, sm: Number(e.target.value) })}
                className="rounded-lg border border-[#e4e0d8] bg-white px-1.5 py-1.5"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((v) => (
                  <option key={v} value={v}>{String(v).padStart(2, "0")}分</option>
                ))}
              </select>
              <span className="text-[#999]">〜</span>
              <select
                value={evEdit.eh}
                onChange={(e) => setEvEdit({ ...evEdit, eh: Number(e.target.value) })}
                className="rounded-lg border border-[#e4e0d8] bg-white px-1.5 py-1.5"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}時</option>
                ))}
              </select>
              <select
                value={evEdit.em}
                onChange={(e) => setEvEdit({ ...evEdit, em: Number(e.target.value) })}
                className="rounded-lg border border-[#e4e0d8] bg-white px-1.5 py-1.5"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((v) => (
                  <option key={v} value={v}>{String(v).padStart(2, "0")}分</option>
                ))}
              </select>
            </div>
            {/* ⏰ アラーム: 予定時刻に通知を鳴らす（自動入力の予定はアラーム無し） */}
            <button
              onClick={async () => {
                const next = !evEdit.alarm;
                if (next) {
                  const ok = await ensureAlarmPermission();
                  if (!ok) { alert("通知が許可されていません。端末の設定でOneSeaの通知を許可してください"); return; }
                }
                setEvEdit({ ...evEdit, alarm: next });
              }}
              className="mt-2.5 w-full rounded-xl border-2 py-2 text-[12.5px] font-extrabold"
              style={
                evEdit.alarm
                  ? { borderColor: "#c94d3a", background: "#fff3f0", color: "#c94d3a" }
                  : { borderColor: "#e0d8c8", background: "#fff", color: "#a09888" }
              }
            >
              {evEdit.alarm ? "⏰ アラームON — 予定時刻に通知します" : "⏰ アラームを設定する"}
            </button>
            {/* 色ペン（タグ名は✎で自由に変えられる） */}
            <div className="mt-2.5 flex items-start gap-2.5">
              {PENS.map((pn) => (
                <div key={pn.id} className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => setEvEdit({ ...evEdit, color: pn.id })}
                    className="h-7 w-7 rounded-full"
                    style={{
                      background: pn.c,
                      border: evEdit.color === pn.id ? "3px solid #333" : "3px solid transparent",
                    }}
                    aria-label={penLabels[pn.id] ?? pn.label}
                  />
                  {penEdit ? (
                    <input
                      value={penLabels[pn.id] ?? pn.label}
                      onChange={(e) => {
                        const next = { ...penLabels, [pn.id]: e.target.value };
                        setPenLabels(next);
                        savePenLabels(next);
                      }}
                      maxLength={5}
                      className="w-11 rounded border border-[#ddd] px-0.5 py-0.5 text-center text-[9px] outline-none"
                    />
                  ) : (
                    <span className="text-[9px] text-[#888]">{penLabels[pn.id] ?? pn.label}</span>
                  )}
                </div>
              ))}
              <button
                onClick={() => setPenEdit(!penEdit)}
                className="ml-auto mt-1 rounded-full border border-[#e0dcd0] px-2 py-1 text-[10px] font-bold text-[#8a8070]"
              >
                {penEdit ? "完了" : "タグ名を自分で変更"}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              {evEdit.id && (
                <button
                  onClick={() => {
                    onSaveEv(dk, dayEvs.filter((x) => x.id !== evEdit.id));
                    setEvEdit(null);
                  }}
                  className="rounded-xl border border-[#eee] px-3.5 py-2.5 text-[12.5px] font-bold text-[#c05030]"
                >
                  削除
                </button>
              )}
              <button onClick={() => setEvEdit(null)} className="rounded-xl px-3 py-2.5 text-[12.5px] font-bold text-[#999]">
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (!evEdit.text.trim()) return;
                  const norm = { ...evEdit, text: evEdit.text.trim() };
                  if (norm.eh < norm.sh || (norm.eh === norm.sh && norm.em <= norm.sm)) {
                    norm.eh = norm.sh;
                    norm.em = Math.min(59, norm.sm + 30);
                  }
                  const evs = norm.id
                    ? dayEvs.map((x) => (x.id === norm.id ? norm : x))
                    : [...dayEvs, { ...norm, id: String(Date.now()) + Math.random().toString(36).slice(2, 6) }];
                  evs.sort((a, b) => a.sh * 60 + a.sm - (b.sh * 60 + b.sm));
                  onSaveEv(dk, evs);
                  setEvEdit(null);
                }}
                disabled={!evEdit.text.trim()}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#c94d3a" }}
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/**
 * ↗ 全画面カレンダー — 1マスの縦幅を最大化して、予定の文字が読める月表示。
 * 叶いタイム・朔弦望は出さず「純粋に予定だけ」。月アイコンはそのまま、
 * 一行目に二十四節気クラス以上(level3+)だけ入れる。
 */
function FullscreenCal({
  mi,
  setMi,
  memos,
  todayK,
  onClose,
  onOpenDay,
}: {
  mi: number;
  setMi: (n: number) => void;
  memos: Memos;
  todayK: string;
  onClose: () => void;
  onOpenDay: (k: string) => void;
}) {
  const [y, m] = MONTHS[mi];
  // 指に追従するスワイプで前後の月へ
  const [dragX, setDragX] = useState(0);
  const [anim, setAnim] = useState(false);
  const tr = useRef({ sx: 0, sy: 0, locked: false, dir: "" as "" | "h" | "v" });
  const onTS = (e: React.TouchEvent) => {
    const t = e.touches[0];
    tr.current = { sx: t.clientX, sy: t.clientY, locked: false, dir: "" };
    setAnim(false);
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
    if (tr.current.dir !== "h") return;
    const maxD = window.innerWidth * 0.55;
    const ratio = Math.min(Math.abs(dx) / window.innerWidth, 1);
    setDragX(dx > 0 ? maxD * Math.pow(ratio, 0.72) : -maxD * Math.pow(ratio, 0.72));
  };
  const onTE = () => {
    if (tr.current.dir !== "h") { setDragX(0); return; }
    const th = window.innerWidth * 0.18;
    setAnim(true);
    if (dragX > th && mi > 0) {
      setDragX(window.innerWidth);
      setTimeout(() => { setMi(mi - 1); setAnim(false); setDragX(0); }, 180);
    } else if (dragX < -th && mi < MONTHS.length - 1) {
      setDragX(-window.innerWidth);
      setTimeout(() => { setMi(mi + 1); setAnim(false); setDragX(0); }, 180);
    } else {
      setDragX(0);
    }
  };
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();
  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = cells.length / 7;
  const key = (d: number) => keyOf(y, m + 1, d);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-white" data-noswipe>
      {/* 上: 年月は小さく・1行だけ */}
      <div className="flex items-center justify-between border-b border-[#eee] px-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)", paddingBottom: 4 }}>
        <button onClick={() => mi > 0 && setMi(mi - 1)} disabled={mi === 0} className="px-2 text-[15px] font-bold text-[#8a7a5a] disabled:opacity-30">‹</button>
        <span className="num text-[12px] font-extrabold tracking-wider text-[#5a5040]">{y}年{m + 1}月</span>
        <span className="flex items-center gap-1">
          <button onClick={() => mi < MONTHS.length - 1 && setMi(mi + 1)} disabled={mi === MONTHS.length - 1} className="px-2 text-[15px] font-bold text-[#8a7a5a] disabled:opacity-30">›</button>
          <button onClick={onClose} aria-label="閉じる" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0ece4] text-[12px] text-[#8a8070]">×</button>
        </span>
      </div>
      {/* 曜日+本体: 指に追従して横に動く */}
      <div
        className="flex flex-1 flex-col"
        onTouchStart={onTS}
        onTouchMove={onTM}
        onTouchEnd={onTE}
        style={{ transform: `translateX(${dragX}px)`, transition: anim ? "transform .18s ease-out" : dragX === 0 ? "transform .15s ease-out" : "none" }}
      >
      <div className="grid grid-cols-7 border-b border-[#eee]">
        {"日月火水木金土".split("").map((w, i) => (
          <div key={w} className="py-[1px] text-center text-[9px] font-bold" style={{ color: i === 0 ? "#c05030" : i === 6 ? "#3070b0" : "#888" }}>
            {w}
          </div>
        ))}
      </div>
      {/* 本体: 残り全部を行で山分けして1マスの縦を最大化 */}
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="border-b border-r border-[#f0ede8] bg-[#fbfaf8]" />;
          const k = key(d);
          const ev = bestOfComputed(k);
          const l = ev?.level ?? 0;
          const moon = moonOf(k);
          const dayM = memos[k];
          const di = i % 7;
          const isT = k === todayK;
          const chips: Array<{ text: string; c: string }> = [];
          for (const e of dayM?.ev ?? []) chips.push({ text: e.text, c: penColor(e.color) });
          for (const [, v] of Object.entries(dayM?.h ?? {})) {
            for (const line of String(v).split("\n")) if (line.trim()) chips.push({ text: line.trim(), c: "#8a9a80" });
          }
          return (
            <button
              key={i}
              onClick={() => onOpenDay(k)}
              className="flex flex-col items-stretch justify-start overflow-hidden border-b border-r border-[#f0ede8] px-[2px] py-[1px] text-left"
              style={{ background: isT ? "#fff2ec" : l >= 4 ? "#fdf4f0" : "#fff", boxShadow: isT ? "inset 0 0 0 2px #c05030" : "none" }}
            >
              <div className="flex items-start gap-[3px] leading-none">
                <span className="text-[11px] font-bold" style={{ color: di === 0 ? "#c05030" : di === 6 ? "#3070b0" : "#444" }}>{d}</span>
                <span className="text-[8px] opacity-85">{moon.emoji}</span>
              </div>
              {l >= 3 && ev?.sekki && (
                <div
                  className="mt-[1px] truncate rounded-[3px] px-[3px] text-center text-[8px] font-extrabold leading-[1.4] text-white"
                  style={{ background: l >= 4 ? "#c02020" : "#b8912a" }}
                >
                  {ev.sekki[0]}
                </div>
              )}
              {(() => {
                // 画面の縦に余白がある限り予定を並べる(はみ出す分だけ+n)
                const cellH = (window.innerHeight - 60) / rows;
                const used = 15 + (l >= 3 && ev?.sekki ? 13 : 0);
                const cap = Math.max(1, Math.floor((cellH - used - 8) / 13));
                return (
                  <>
                    {chips.slice(0, cap).map((c, j) => (
                      <div
                        key={j}
                        className="mx-auto mt-[1px] w-fit max-w-full truncate rounded-[3px] px-[3px] text-center text-[8px] font-bold leading-[1.35] text-white"
                        style={{ background: c.c }}
                      >
                        {c.text}
                      </div>
                    ))}
                    {chips.length > cap && <div className="text-center text-[7px] leading-none text-[#a09880]">+{chips.length - cap}</div>}
                  </>
                );
              })()}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}
