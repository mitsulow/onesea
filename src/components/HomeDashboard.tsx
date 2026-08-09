"use client";

import { PlaceOverlay, type PlaceInfo } from "@/components/PlaceOverlay";
import { readTecho, writeTecho } from "@/lib/techoStore";
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
  holyTimeOf,
  kyurekiLabel,
  todayKey,
  keyOf,
  YOBI,
  SHISHI_COLOR,
} from "@/lib/almanac";
import { TideDay, fetchTideDay } from "@/lib/tide";
import { subscribeUnread } from "@/lib/unreadStore";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";

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

  /* 予定（手帳から）— 予定が入っている日だけをスワイプで前後に渡り歩ける */
  const [dayPlans, setDayPlans] = useState<Record<string, Array<{ time: string; text: string; color?: string; place?: PlaceInfo; evPost?: string; src?: { t: "ev"; id: string } | { t: "h"; hour: string; line: string } }>>>({});
  const [homePlace, setHomePlace] = useState<PlaceInfo | null>(null); // 予定の「地図」ボタンで開くオーバーレイ
  const [delIdx, setDelIdx] = useState<number | null>(null); // 長押しで×が出ている行
  const planPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planLongFired = useRef(false); // 長押し後のタップ暴発防止
  const planStart = useRef<{ x: number; y: number } | null>(null);
  /** 予定を手帳から削除(長押し→×→確認) */
  const deletePlan = (k: string, it: { src?: { t: "ev"; id: string } | { t: "h"; hour: string; line: string } }) => {
    if (!it.src) return;
    if (!confirm("本当に削除しますか？")) return;
    try {
      const memos = JSON.parse(readTecho());
      const day = memos[k];
      if (!day) return;
      if (it.src.t === "ev") {
        day.ev = (day.ev ?? []).filter((x: { id: string }) => x.id !== (it.src as { id: string }).id);
        if (!day.ev.length) delete day.ev;
      } else {
        const src = it.src;
        const rest = String(day.h?.[src.hour] ?? "").split("\n").filter((l: string) => l.trim() !== src.line);
        if (rest.filter((l: string) => l.trim()).length) day.h[src.hour] = rest.join("\n");
        else if (day.h) delete day.h[src.hour];
      }
      if (!day.note && Object.keys(day.h ?? {}).length === 0 && !(day.ev ?? []).length) delete memos[k];
      else memos[k] = day;
      writeTecho(JSON.stringify(memos));
      window.dispatchEvent(new Event("onesea:techoChanged"));
    } catch {}
    setDelIdx(null);
  };
  const [planKeys, setPlanKeys] = useState<string[]>([]);
  const [viewKey, setViewKey] = useState(tk);
  const [planDragX, setPlanDragX] = useState(0);
  const planTouch = useRef<{ x: number; y: number; locked: boolean; dir: string | null } | null>(null);
  useEffect(() => {
    fetchTideDay(tk).then(setTide);
    // キャッシュを避けて常に最新の実測値を取る（10分ごとに更新）
    const loadSchumann = () =>
      fetch("/api/sr/schumann_data.json", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setSchumann(d?.modes?.F1?.hz ?? null))
        .catch(() => {});
    loadSchumann();
    const schT = setInterval(loadSchumann, 10 * 60000);
    const loadPlans = () => {
    try {
      const memos = JSON.parse(readTecho());
      const byDay: Record<string, Array<{ time: string; text: string; color?: string; place?: PlaceInfo; evPost?: string; src?: { t: "ev"; id: string } | { t: "h"; hour: string; line: string } }>> = {};
      const keys: string[] = [];
      for (const [k, day] of Object.entries(memos) as Array<[string, any]>) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const list: Array<{ time: string; text: string; color?: string; place?: PlaceInfo; evPost?: string; src?: { t: "ev"; id: string } | { t: "h"; hour: string; line: string } }> = [];
        for (const ev of day?.ev ?? []) {
          const evPost = typeof ev.id === "string" && ev.id.startsWith("sekai-") ? ev.id.slice(6) : undefined;
          list.push({ time: `${pad(ev.sh)}:${pad(ev.sm)}`, text: ev.text, color: ev.color, place: ev.place, evPost, src: { t: "ev", id: ev.id } });
        }
        for (const [h, v] of Object.entries(day?.h ?? {})) {
          for (const line of String(v).split("\n")) {
            if (line.trim()) list.push({ time: `${pad(Number(h))}:00`, text: line.trim(), src: { t: "h", hour: h, line: line.trim() } });
          }
        }
        if (list.length) {
          list.sort((a, b) => a.time.localeCompare(b.time));
          byDay[k] = list.slice(0, 6);
          keys.push(k);
        }
      }
      // 今日は予定が無くてもスワイプ経路に必ず入れる(過去から戻れなくなる問題の防止)
      if (!keys.includes(tk)) keys.push(tk);
      keys.sort();
      setDayPlans(byDay);
      setPlanKeys(keys);
    } catch {}
    };
    loadPlans();
    window.addEventListener("onesea:techoChanged", loadPlans); // 手帳で消したら即トップからも消す
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("birthday").eq("id", uid).maybeSingle();
      if (prof?.birthday) {
        setAdvDays(Math.floor((Date.now() - new Date(prof.birthday + "T00:00:00+09:00").getTime()) / 86400000) + 1);
      }
    });
    return () => {
      clearInterval(schT);
      window.removeEventListener("onesea:techoChanged", loadPlans);
    };
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
    <section className="bg-white pb-2 text-center" style={{ margin: "0 -16px" }}>
      <TopTone color="#0e1116" />
      {/* 題字 — ここだけ黒帯（「い」を小さくする元のバージョン）。右にアバター＝他サービスの入口
          統一規格: 高さ52px・サービス名センター・アバター右 */}
      <div className="relative flex h-[52px] items-center justify-center" style={{ background: "#0e1116" }}>
        <span className="flex items-center gap-2 text-[16px] font-extrabold tracking-[3px] text-[#e8d5a0]">
          <img src={moonImageOf(moon.age)} alt="" className="h-7 w-7 rounded-full" loading="lazy" />
          願<span style={{ fontSize: "70%" }}>い</span>叶<span style={{ fontSize: "70%" }}>い</span>手帳
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <AvatarMenu ring="#e8d5a0" />
        </span>
      </div>

      {/* 日付 — 主役。曜日まで同じ書体・同じ色で一体。右上に地球冒険(小) */}
      <div className="flex items-center justify-between px-3 pt-1.5">
        <span className="num flex items-center gap-1 text-[10px] font-bold text-[#a09880]">
          {advDays != null && (
            <>
              <img src="/icons/cel-earth.png" alt="" style={{ width: 13, height: 13 }} />
              {advDays.toLocaleString()}回目の地球冒険
            </>
          )}
        </span>
        <a href="/schumann1/index.html" className="num text-[10px] font-bold text-[#3aa890] no-underline">
          今日の周波数 {schumann != null ? schumann.toFixed(2) : "—"}Hz{" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/cel-sun.png" alt="" className="inline-block h-[13px] w-[13px] object-contain align-[-2.5px]" />
        </a>
      </div>
      <div className="pt-0.5" style={{ fontFamily: MINCHO }}>
        <span className="text-[27px] font-bold tracking-wide text-[#2a2622]">
          {m}月{d}日<span className="text-[0.78em]">({dow})</span>
        </span>
      </div>
      <div className="-mt-1 text-[11.5px] tracking-[1px] text-[#a09880]">
        {kyurekiLabel(tk)}
        {best?.sekki && (
          <span className="ml-2 font-bold" style={{ color: accent }}>
            {best.sekki[0]}
          </span>
        )}
        {moon.holy && <span className="ml-2 font-bold text-[#c09030]">{moon.holy}</span>}
      </div>

      {/* ★今日のティッカー — 太陽・月・地球の情報が右から左へ流れる */}
      {(() => {
        const deg = best?.deg;
        const lv = deg == null ? 1
          : deg === 270 ? 360
          : deg === 90 ? 180
          : deg === 0 || deg === 180 ? 90
          : [45, 135, 225, 315].includes(deg) ? 45
          : deg % 15 === 0 ? 15
          : deg % 5 === 0 ? 5
          : 1;
        const holy = holyTimeOf(tk);
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        let nearTide: [string, string] | null = null;
        for (const [lb, t2] of tideRows) {
          const [hh, mm2] = t2.split(":").map(Number);
          if (hh * 60 + mm2 >= nowMin) { nearTide = [lb, t2]; break; } // 次に来る潮
        }
        if (!nearTide && tideRows.length) nearTide = tideRows[tideRows.length - 1];
        const IconSpan = ({ src }: { src: string }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="mx-1.5 inline-block h-[15px] w-[15px] rounded-full object-contain align-[-3px]" />
        );
        return (
          <button
            onClick={openToday}
            className="block w-full overflow-hidden py-1"
            aria-label="今日のこよみ"
          >
            <style>{`@keyframes tickerX { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
            <div className="flex w-max whitespace-nowrap" style={{ animation: "tickerX 40s linear infinite" }}>
              {[0, 1].map((k) => (
                <span key={k} className="num flex items-center text-[12px] font-bold" style={{ color: "#7a6a48" }}>
                  <IconSpan src="/icons/cel-sun.png" />
                  今日の叶いタイム <b className="mx-1 text-[14px]" style={{ color: "#c94d3a" }}>{best?.time ?? "—"}</b>
                  <span style={{ color: lv >= 90 ? "#c9002a" : lv >= 45 ? "#d97020" : "#a08c30" }}>（叶いレベル{lv}・{lv === 360 ? "最強" : lv === 180 ? "超すごい" : lv === 90 ? "凄い" : lv === 45 ? "かなり強い" : lv === 15 ? "強い" : lv === 5 ? "少し強い" : "普通"}）</span>
                  {best?.sekki && (
                    <span className="ml-1 font-extrabold" style={{ color: lv >= 180 ? "#c9002a" : "#2a8a4a" }}>
                      願い叶いレベル{lv === 360 ? "最強" : lv === 180 ? "超すごい" : lv === 90 ? "凄い" : lv === 45 ? "かなり強い" : "強め"}の日「{best.sekki[0]}点{best?.time ?? ""}」です
                    </span>
                  )}
                  {best?.kou && <span className="ml-2" style={{ color: "#6a8a50" }}>七十二候「{best.kou[0]}」</span>}
                  <IconSpan src={moonImageOf(moon.age)} />
                  今日の月は月齢{moon.age.toFixed(1)}、{mt.rise ? `月の出は${mt.rise}` : mt.set ? `月の入りは${mt.set}` : ""}
                  {holy && <span className="ml-1 font-extrabold" style={{ color: "#b8912a" }}>本日{holy.name}（{holy.label}）{holy.time}</span>}
                  {nearTide && (
                    <>
                      <IconSpan src="/icons/cel-earth.png" />
                      次の{nearTide[0]}潮時刻は{nearTide[1]}です
                    </>
                  )}
                  <span className="mx-6" style={{ color: "#6a5a30" }}>✦</span>
                </span>
              ))}
            </div>
          </button>
        );
      })()}


      {homePlace && <PlaceOverlay place={homePlace} onClose={() => setHomePlace(null)} />}
      {/* 予定 — 予定が入っている日だけをスワイプ/矢印で前後に渡れる */}
      {(() => {
        const plans = dayPlans[viewKey] ?? [];
        const prevKey = [...planKeys].reverse().find((k) => k < viewKey) ?? null;
        const nextKey = planKeys.find((k) => k > viewKey) ?? null;
        const shortD = (k: string) => `${Number(k.split("-")[1])}/${Number(k.split("-")[2])}`;
        const label = (() => {
          if (viewKey === tk) return "本日の予定";
          const [yy, mm, dd] = viewKey.split("-").map(Number);
          const diff = Math.round((new Date(yy, mm - 1, dd).getTime() - new Date(y, m - 1, d).getTime()) / 86400000);
          const dw = YOBI[new Date(yy, mm - 1, dd).getDay()];
          return diff === 1 ? "明日の予定" : diff === -1 ? "昨日の予定" : `${mm}/${dd}（${dw}）の予定`;
        })();
        const openView = () => {
          if (Math.abs(planDragX) > 8) return; // スワイプ後の誤タップ防止
          if (viewKey === tk) openToday();
          else window.dispatchEvent(new CustomEvent("onesea:openDay", { detail: viewKey }));
        };
        const go = (k: string | null) => {
          if (k) setViewKey(k);
          setPlanDragX(0);
        };
        return (
          <div
            data-noswipe
            className="relative mt-3 overflow-hidden"
            style={{
              background: "repeating-linear-gradient(0deg, #f6efdf, #f6efdf 30px, #e9dcc0 31px)",
              borderTop: "1px solid #e0d4b8",
              borderBottom: "1px solid #e0d4b8",
            }}
            onTouchStart={(e) => {
              planTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: false, dir: null };
            }}
            onTouchMove={(e) => {
              const t = planTouch.current;
              if (!t) return;
              const dx = e.touches[0].clientX - t.x;
              const dy = e.touches[0].clientY - t.y;
              if (!t.locked) {
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                  t.locked = true;
                  t.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
                }
                return;
              }
              if (t.dir === "h") setPlanDragX(Math.max(-90, Math.min(90, dx * 0.6)));
            }}
            onTouchEnd={() => {
              const dx = planDragX;
              planTouch.current = null;
              if (dx < -34 && nextKey) go(nextKey); // 左へ払う = 次に予定がある日
              else if (dx > 34 && prevKey) go(prevKey); // 右へ払う = 前に予定がある日
              else setPlanDragX(0);
            }}
          >
            {/* 見出し: ‹ 前の日付 ── ラベル ── 次の日付 › で「渡れる」ことを見せる */}
            <div className="flex items-center justify-between px-2.5 pt-2.5">
              <button
                onClick={() => go(prevKey)}
                disabled={!prevKey}
                className="num flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold disabled:opacity-25"
                style={{ color: "#7ba05b" }}
                aria-label="前の予定日へ"
              >
                ‹ {prevKey ? shortD(prevKey) : "前"}
              </button>
              <span className="text-[11.5px] font-bold tracking-[3px] text-[#7ba05b]">{label}</span>
              <button
                onClick={() => go(nextKey)}
                disabled={!nextKey}
                className="num flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold disabled:opacity-25"
                style={{ color: "#7ba05b" }}
                aria-label="次の予定日へ"
              >
                {nextKey ? shortD(nextKey) : "次"} ›
              </button>
            </div>
            <button
              onClick={() => {
                if (planLongFired.current) {
                  planLongFired.current = false;
                  return; // 長押し直後のタップ暴発は無視(×を出すだけ)
                }
                if (delIdx != null) {
                  setDelIdx(null); // ×が出ている時のタップは解除
                  return;
                }
                openView();
              }}
              className="block w-full px-4 pb-3 pt-1 text-left"
              style={{
                transform: `translateX(${planDragX}px)`,
                opacity: 1 - Math.abs(planDragX) / 220,
                transition: planTouch.current ? "none" : "transform .18s ease, opacity .18s ease",
              }}
            >
              <div className="space-y-2">
                {plans.length ? (
                  plans.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-2.5"
                      onTouchStart={(e) => {
                        const t = e.touches[0];
                        planStart.current = { x: t.clientX, y: t.clientY };
                        planPress.current = setTimeout(() => {
                          planLongFired.current = true;
                          setDelIdx(i);
                        }, 550);
                      }}
                      onTouchEnd={() => planPress.current && clearTimeout(planPress.current)}
                      onTouchMove={(e) => {
                        // 指の微ブレでは長押しを取り消さない(10px以上動いたらキャンセル)
                        const t = e.touches[0];
                        const st = planStart.current;
                        if (st && Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10 && planPress.current) clearTimeout(planPress.current);
                      }}
                      onMouseDown={() => {
                        planPress.current = setTimeout(() => {
                          planLongFired.current = true;
                          setDelIdx(i);
                        }, 550);
                      }}
                      onMouseUp={() => planPress.current && clearTimeout(planPress.current)}
                      onMouseLeave={() => planPress.current && clearTimeout(planPress.current)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <span className="num flex-shrink-0 text-[13px] text-[#a09880]">{p.time}</span>
                      {p.color && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: p.color }} />}
                      {/* 行タップ(=日付を開く)とは別に、地図と詳細だけをここで開ける小ボタン */}
                      {p.place && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // セカイムラ由来はDBの最新の場所で開く(古い誤座標の自動修正)
                            if (p.evPost) {
                              try {
                                const { data } = await createClient()
                                  .from("village_posts")
                                  .select("place_name, place_lat, place_lng, place_url")
                                  .eq("id", p.evPost)
                                  .maybeSingle();
                                if (data && (data.place_lat != null || data.place_name)) {
                                  setHomePlace({ name: data.place_name, lat: data.place_lat, lng: data.place_lng, url: data.place_url });
                                  return;
                                }
                              } catch {}
                            }
                            setHomePlace(p.place!);
                          }}
                          className="flex-shrink-0 self-center rounded-full border px-1.5 py-[1px] text-[9.5px] font-extrabold"
                          style={{ borderColor: "#7ba05b", color: "#4a7a3a", background: "#f2f8ec" }}
                        >
                          地図
                        </span>
                      )}
                      {p.evPost && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            window.location.href = "/sekai?event=" + p.evPost;
                          }}
                          className="flex-shrink-0 self-center rounded-full border px-1.5 py-[1px] text-[9.5px] font-extrabold"
                          style={{ borderColor: "#c8a030", color: "#a07820", background: "#fdf6e4" }}
                        >
                          詳細
                        </span>
                      )}
                      <span className="truncate text-[18px] text-[#3a352c]" style={{ fontFamily: MINCHO }}>
                        {p.text}
                      </span>
                      {delIdx === i && p.src && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            deletePlan(viewKey, p);
                          }}
                          className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center self-center rounded-full text-[13px] font-bold text-white"
                          style={{ background: "#c05030" }}
                        >
                          ×
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-1 text-center text-[13.5px] leading-relaxed text-[#b0a890]" style={{ fontFamily: MINCHO }}>
                    今日の予定はありません
                    <br />
                    <span className="text-[#7ba05b]">タップして書く ✎</span>
                  </div>
                )}
              </div>
            </button>
          </div>
        );
      })()}

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
    let unsub: (() => void) | null = null;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid || stop) return;
      unsub = subscribeUnread(uid, setUnread); // 共有ポーラー（1タブ1本）
    });
    return () => {
      stop = true;
      unsub?.();
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
    { href: "/cotozute", icon: "/icons/tab-cotozute2.webp", label: "コトヅテ" },
    { href: "/za", icon: "/icons/icon-za-mark.svg", label: "楽市楽座" },
    { href: "/talk", icon: "💬", label: "TalK", talk: true },
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
