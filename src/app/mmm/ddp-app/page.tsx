"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import { saveMyDdp } from "@/lib/mmm";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/**
 * 「DDP — 願いを、通す。」
 * 目標管理ツールではない。願いを「叶う形」まで精錬し、冬至に向けて封じる静かな儀式の器。
 * 原理: 現実は観測者が信じたとおりに見えている。願いは頑張って信じるものではなく、
 *       すでに信じられる粒まで分解して積み上げるもの。
 */

/** 期日は設定値（来期は日付だけ差し替える） */
const TERM = { key: "2026winter", label: "2026冬至", sealBy: "2026-08-08", openAt: "2026-12-21" };

const C = {
  bg: "#0E1230", card: "#1B2148", line: "#2A3163", ink: "#F2EFE6",
  sub: "#9BA0C4", gold: "#E8B84B", goldDim: "#8A6E2F", ok: "#7FC8A9", warn: "#E08A8A",
};

interface Item { iyada: string; shitai: string; naritai: string }
interface Store {
  v: number; step: number; items: Item[]; core: string; checks: boolean[];
  details: string[]; ddp: string; sealed: boolean; sealedAt: string | null;
  answers: Record<string, string>; ai: { pass: boolean; comment: string; polished: string } | null;
}
const EMPTY: Store = { v: 1, step: 0, items: [], core: "", checks: [false, false, false], details: ["", "", ""], ddp: "", sealed: false, sealedAt: null, answers: {}, ai: null };

const FREQ_BASE = 7.83;
const FREQ_FINAL = "8.0219032748";

export default function DdpRitualPage() {
  const [me, setMe] = useState<User | null>(null);
  const [st, setSt] = useState<Store>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [toneOn, setToneOn] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const skey = useCallback((uid: string | null) => `ddp:${uid ?? "guest"}:${TERM.key}`, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      try {
        const raw = localStorage.getItem(skey(u?.id ?? null)) ?? localStorage.getItem(skey(null));
        if (raw) setSt({ ...EMPTY, ...JSON.parse(raw) });
      } catch {}
      setLoaded(true);
    });
  }, [skey]);

  /* 900msデバウンス自動保存 */
  const save = useCallback((next: Store, uid: string | null) => {
    setSt(next);
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try { localStorage.setItem(`ddp:${uid ?? "guest"}:${TERM.key}`, JSON.stringify(next)); } catch {}
    }, 900);
  }, []);
  const up = (patch: Partial<Store>) => save({ ...st, ...patch }, me?.id ?? null);

  /* 整えの音 — Web Audio合成のみ（sine 501.12Hz を 8.0219032748Hz LFO で振幅ゆらし） */
  const toggleTone = () => {
    if (toneOn) {
      audioRef.current?.stop();
      audioRef.current = null;
      setToneOn(false);
      return;
    }
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 501.12; // D基音 = 7.83 × 64
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 8.0219032748;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.045;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 2.5);
      osc.start(); lfo.start();
      audioRef.current = {
        ctx,
        stop: () => {
          try {
            gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
            setTimeout(() => { try { osc.stop(); lfo.stop(); ctx.close(); } catch {} }, 1400);
          } catch {}
        },
      };
      setToneOn(true);
    } catch {}
  };
  useEffect(() => () => audioRef.current?.stop(), []);

  const today = new Date();
  const openDate = new Date(TERM.openAt + "T00:00:00+09:00");
  const unsealed = today >= openDate;

  const naritaiChips = st.items.filter((i) => i.naritai.trim());
  const detailsOk = st.details.filter((d) => d.trim()).length >= 3;
  const freqNow = st.sealed ? FREQ_FINAL : (FREQ_BASE + (parseFloat(FREQ_FINAL) - FREQ_BASE) * Math.min(1, st.step / 4)).toFixed(4);

  const seal = async () => {
    if (!st.ddp.trim()) return;
    const next = { ...st, sealed: false, sealedAt: null, step: 4 };
    save(next, me?.id ?? null);
    try { localStorage.setItem(skey(me?.id ?? null), JSON.stringify(next)); } catch {}
    // ニューラFIVEの仲間・マイページに見えるDDP（短い夢）に反映
    if (me) await saveMyDdp(me.id, st.ddp.trim());
    alert("DDPを保存しました。マイページの一番上にも表示されます✨");
  };

  const runAi = async () => {
    if (aiBusy || !st.ddp.trim()) return;
    setAiBusy(true);
    try {
      const r = await fetch("/api/ddp/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ddp: st.ddp, items: st.items, details: st.details }),
      });
      if (r.ok) up({ ai: await r.json() });
      else if (r.status === 503) alert("AI審査はいま準備中です（審査なしでも封印できます）");
      else alert("AI審査がうまくいきませんでした。審査なしでも封印できます");
    } catch {
      alert("AI審査がうまくいきませんでした。審査なしでも封印できます");
    }
    setAiBusy(false);
  };

  if (!loaded) return <main className="p-8 text-center text-sm" style={{ background: C.bg, minHeight: "100dvh", color: C.sub }}>…</main>;

  const inputCls = "w-full rounded-xl border p-2.5 text-[13.5px] outline-none";
  const inputStyle = { background: "#141838", borderColor: C.line, color: C.ink } as const;

  return (
    <main className="min-h-screen pb-28" style={{ background: C.bg, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap');
        .mincho { font-family: 'Shippori Mincho', serif; }
        @keyframes sealGlow { 0%{transform:scale(.2);opacity:0} 60%{transform:scale(1.15);opacity:1} 100%{transform:scale(1)} }
      `}</style>

      <header className="relative z-[60] flex items-center justify-center px-6 py-2.5" style={{ background: "#0a0e26" }}>
        <span className="mincho text-[16px] font-bold tracking-[4px]" style={{ color: C.ink }}>
夢叶えナビ <span className="text-[11px]" style={{ color: C.sub }}>〜DDPを設定する〜</span>
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2"><AvatarMenu ring={C.gold} /></span>
      </header>

      {/* 正弦波プログレス + 周波数 */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#0a0e26", borderBottom: `1px solid ${C.line}` }}>
        <svg width="100%" height="18" viewBox="0 0 500 18" preserveAspectRatio="none" className="min-w-0 flex-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M ${i * 100} 9 q 25 -8 50 0 q 25 8 50 0`}
              fill="none"
              stroke={i <= st.step ? C.gold : C.line}
              strokeWidth={i <= st.step ? 2 : 1.2}
            />
          ))}
        </svg>
        <span className="num flex-shrink-0 text-[10px]" style={{ color: st.sealed ? C.gold : C.sub }}>{freqNow} Hz</span>
      </div>

      <div className="mx-auto max-w-[640px] px-4 pt-4">
        {/* ===== 封印済み ===== */}
        {false ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px solid ${C.goldDim}` }}>
            <div
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: `radial-gradient(circle at 35% 30%, ${C.gold}, ${C.goldDim})`, boxShadow: `0 0 40px ${C.gold}55`, animation: "sealGlow 1.2s ease-out" }}
            >
              <span className="mincho text-[26px] font-bold" style={{ color: "#0E1230" }}>封</span>
            </div>
            <p className="mincho text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>
              あなたのDDPは封印されました。
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: C.sub }}>
              冬至の朝（{TERM.openAt.replace(/-/g, "/")}）、開封できます。
              <br />ここからは自分の願いを完全に忘れ、
              <br />仲間の願いを叶えることに集中してください。
            </p>
            <a href="/mmm/neura" className="mt-4 inline-block rounded-xl px-5 py-2.5 text-[13px] font-bold no-underline" style={{ background: C.gold, color: "#0E1230" }}>
              ニューラFIVEへ →
            </a>
          </div>
        ) : st.sealed && unsealed ? (
          /* ===== 終幕: 開封と答え合わせ ===== */
          <div>
            <div className="mb-3 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.gold}` }}>
              <div className="mincho mb-1 text-[11px] tracking-[3px]" style={{ color: C.gold }}>開封 — あなたのDDP</div>
              <p className="mincho whitespace-pre-wrap text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>{st.ddp}</p>
            </div>
            <div className="mb-2 text-[12px] font-bold" style={{ color: C.sub }}>答え合わせ — それぞれ、どうなりましたか？</div>
            {[st.ddp, ...st.details.filter((d) => d.trim())].map((item, i) => {
              const k = i === 0 ? "__core" : `d${i}`;
              return (
                <div key={k} className="mb-2 rounded-xl p-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                  <div className="mb-1.5 text-[12.5px]" style={{ color: C.ink }}>{i === 0 ? "【核】" : "・"}{item}</div>
                  <div className="flex gap-1.5">
                    {["叶った", "芽が出た", "まだ"].map((a) => (
                      <button
                        key={a}
                        onClick={() => up({ answers: { ...st.answers, [k]: a } })}
                        className="flex-1 rounded-lg border py-1.5 text-[11.5px] font-bold"
                        style={
                          st.answers[k] === a
                            ? { background: a === "叶った" ? C.ok : a === "芽が出た" ? C.gold : C.line, color: "#0E1230", borderColor: "transparent" }
                            : { background: "transparent", color: C.sub, borderColor: C.line }
                        }
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="py-3 text-center text-[11px]" style={{ color: C.sub }}>書いた紙は捨てない。答え合わせは、楽しい。</p>
          </div>
        ) : (
          /* ===== 儀式 5幕 ===== */
          <>
            {/* 幕タブ */}
            <div className="mb-3 flex gap-1">
              {["原理", "道をつくる", "三つの関門", "積み重ね", "確定と封印"].map((label, i) => (
                <button
                  key={i}
                  onClick={() => up({ step: i })}
                  className="flex-1 rounded-lg py-1.5 text-[9.5px] font-bold"
                  style={st.step === i ? { background: C.gold, color: "#0E1230" } : { background: C.card, color: i < st.step ? C.gold : C.sub }}
                >
                  {i}. {label}
                </button>
              ))}
            </div>

            {/* ── 第0幕 原理 ── */}
            {st.step === 0 && (
              <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div className="mincho mb-3 text-[15px] font-bold tracking-[2px]" style={{ color: C.gold }}>第0幕 — 原理</div>
                <p className="mincho text-[14px] leading-loose" style={{ color: C.ink }}>
                  現実は、観測者が信じたとおりに見えている。
                  <br />だから願いは、頑張って信じるものではなく、
                  <br /><b style={{ color: C.gold }}>すでに信じられる粒まで分解して、積み上げる</b>もの。
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: C.sub }}>
                  幸せの定義は「やりたいことを、やりたい時に、やりたい量だけ」。
                  強く願うほど「叶っていない」と信じる証拠になる。
                  あなたがこれからやるのは、願うことではなく、願いを精錬すること。
                </p>
                <button
                  onClick={toggleTone}
                  className="mt-4 w-full rounded-xl border py-3 text-[13px] font-bold"
                  style={toneOn ? { background: C.gold, color: "#0E1230", borderColor: C.gold } : { background: "transparent", color: C.gold, borderColor: C.goldDim }}
                >
                  {toneOn ? "◉ 整えの音 — 鳴っています（もう一度押して止める）" : "○ 整えの音を鳴らす（ふわっと力が抜けてから書く）"}
                </button>
                <button onClick={() => up({ step: 1 })} className="mt-2.5 w-full rounded-xl py-3 text-[14px] font-extrabold" style={{ background: C.gold, color: "#0E1230" }}>
                  はじめる →
                </button>
              </div>
            )}

            {/* ── 第1幕 道をつくる ── */}
            {st.step === 1 && (
              <div>
                <div className="mb-3 rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                  <div className="mincho mb-1 text-[14px] font-bold tracking-[2px]" style={{ color: C.gold }}>第1幕 — 道をつくる</div>
                  <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>
                    「やりたくないこと」を入れると、問いが返ってくる。
                    ✕ → 道（したい） → ☀（なりたい）まで書けたとき、道が通る。いくつでも。
                  </p>
                  <button
                    onClick={() => up({ items: [...st.items, { iyada: "", shitai: "", naritai: "" }] })}
                    className="mt-2.5 w-full rounded-xl border border-dashed py-2.5 text-[13px] font-bold"
                    style={{ borderColor: C.goldDim, color: C.gold }}
                  >
                    ＋ やりたくないことを入れる
                  </button>
                </div>
                {st.items.map((it, i) => {
                  const through = !!it.naritai.trim();
                  return (
                    <div key={i} className="relative mb-3 rounded-2xl p-4" style={{ background: C.card, border: `1.5px solid ${through ? C.gold : C.line}`, boxShadow: through ? `0 0 18px ${C.gold}30` : "none" }}>
                      <span className="absolute bottom-3 left-[26px] top-3 w-0" style={{ borderLeft: through ? `2px solid ${C.gold}` : `2px dashed ${C.line}` }} />
                      <div className="relative space-y-2.5 pl-7">
                        <div>
                          <div className="mb-1 text-[10.5px] font-bold" style={{ color: C.warn }}><span className="absolute -left-7 top-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: "#3a2035", color: C.warn }}>✕</span>やりたくないこと</div>
                          <input value={it.iyada} onChange={(e) => { const items = [...st.items]; items[i] = { ...it, iyada: e.target.value }; up({ items }); }} className={inputCls} style={inputStyle} placeholder="例: 満員電車に乗りたくない" />
                        </div>
                        {it.iyada.trim() && (
                          <div>
                            <div className="mincho mb-1 text-[12px]" style={{ color: C.ink }}>——じゃあ、どうしたいの？</div>
                            <div className="mb-1 text-[10.5px] font-bold" style={{ color: C.sub }}><span className="absolute -left-7 flex h-5 w-5 items-center justify-center rounded-full text-[9px]" style={{ background: "#252a52", color: C.sub }}>道</span>したい（まだ道＝手段）</div>
                            <input value={it.shitai} onChange={(e) => { const items = [...st.items]; items[i] = { ...it, shitai: e.target.value }; up({ items }); }} className={inputCls} style={inputStyle} placeholder="例: 家の近くで働きたい" />
                          </div>
                        )}
                        {it.shitai.trim() && (
                          <div>
                            <div className="mincho mb-1 text-[12px]" style={{ color: C.ink }}>——その道の先で、どうなりたいの？</div>
                            <div className="mb-1 text-[10.5px] font-bold" style={{ color: C.gold }}><span className="absolute -left-7 flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: "#3a3220", color: C.gold }}>☀</span>なりたい</div>
                            <input value={it.naritai} onChange={(e) => { const items = [...st.items]; items[i] = { ...it, naritai: e.target.value }; up({ items }); }} className={inputCls} style={inputStyle} placeholder="例: 朝ゆっくり家族と朝ごはんを食べている私" />
                          </div>
                        )}
                        {through && <div className="text-[11px] font-bold" style={{ color: C.gold }}>✦ 道が通りました</div>}
                      </div>
                      <button onClick={() => up({ items: st.items.filter((_, j) => j !== i) })} className="absolute right-2 top-2 text-[11px]" style={{ color: C.sub }}>✕</button>
                    </div>
                  );
                })}
                {naritaiChips.length > 0 && (
                  <button onClick={() => up({ step: 2 })} className="w-full rounded-xl py-3 text-[14px] font-extrabold" style={{ background: C.gold, color: "#0E1230" }}>
                    三つの関門へ →（☀ {naritaiChips.length}個）
                  </button>
                )}
              </div>
            )}

            {/* ── 第2幕 三つの関門 ── */}
            {st.step === 2 && (
              <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div className="mincho mb-1 text-[14px] font-bold tracking-[2px]" style={{ color: C.gold }}>第2幕 — 三つの関門</div>
                <p className="mb-2 text-[12px]" style={{ color: C.sub }}>通った道の先の「☀ なりたい」から、DDPの核をひとつ選ぶ（組み合わせて書き直してもよい）。</p>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {naritaiChips.map((it, i) => (
                    <button key={i} onClick={() => up({ core: it.naritai })} className="rounded-full border px-3 py-1.5 text-[11.5px]" style={{ borderColor: C.goldDim, color: C.ink, background: st.core === it.naritai ? "#3a3220" : "transparent" }}>
                      ☀ {it.naritai}
                    </button>
                  ))}
                </div>
                <textarea value={st.core} onChange={(e) => up({ core: e.target.value })} rows={3} className={inputCls + " mincho"} style={inputStyle} placeholder="DDPの核（なりたいの層で）" />
                <div className="mt-3 space-y-2">
                  {[
                    ["一の関門・手段性", "宝くじ・漠然とした3億円は道であって目的地ではない。「道の先の状態」で書けている"],
                    ["二の関門・時間性", "期限は12月21日（冬至）。未来をまるごと今に持ってくる願いになっていない（砂漠で自動販売機を背負う男を思い出す）"],
                    ["三の関門・自己中心性", "他人との比較・他人の心のコントロールが不要。主導権が自分に戻っている（「その曲を私自身が楽しんでいる」へ）"],
                  ].map(([title, desc], i) => (
                    <button key={i} onClick={() => { const checks = [...st.checks] as boolean[]; checks[i] = !checks[i]; up({ checks }); }} className="flex w-full items-start gap-2.5 rounded-xl border p-3 text-left" style={{ borderColor: st.checks[i] ? C.ok : C.line, background: st.checks[i] ? "#16281f" : "transparent" }}>
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px]" style={{ borderColor: st.checks[i] ? C.ok : C.sub, color: st.checks[i] ? C.ok : "transparent" }}>✓</span>
                      <span>
                        <span className="mincho block text-[12.5px] font-bold" style={{ color: st.checks[i] ? C.ok : C.ink }}>{title}</span>
                        <span className="block text-[11px] leading-relaxed" style={{ color: C.sub }}>{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => up({ step: 3 })}
                  disabled={!st.core.trim() || !st.checks.every(Boolean)}
                  className="mt-3 w-full rounded-xl py-3 text-[14px] font-extrabold disabled:opacity-30"
                  style={{ background: C.gold, color: "#0E1230" }}
                >
                  {st.checks.every(Boolean) ? "門が開いた — 積み重ねへ →" : "三つすべてに✓が入ると、門が開く"}
                </button>
              </div>
            )}

            {/* ── 第3幕 積み重ね ── */}
            {st.step === 3 && (
              <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div className="mincho mb-1 text-[14px] font-bold tracking-[2px]" style={{ color: C.gold }}>第3幕 — 積み重ね</div>
                <p className="mb-2.5 text-[12px] leading-relaxed" style={{ color: C.sub }}>
                  一度も想像したことのない100平米のキッチンは叶わない。
                  「気持ちよく切れる包丁」「窓から見えるお客さんの笑顔」なら、いま簡単に信じられる。
                  核を支えるディテールを<b style={{ color: C.ink }}>最低3つ</b>。
                </p>
                <div className="mb-2 rounded-xl p-2.5 text-[12.5px]" style={{ background: "#141838", color: C.ink }}>核: {st.core || "—"}</div>
                {st.details.map((d, i) => (
                  <input key={i} value={d} onChange={(e) => { const details = [...st.details]; details[i] = e.target.value; up({ details }); }} className={inputCls + " mb-2"} style={inputStyle} placeholder={`信じられる粒 ${i + 1}`} />
                ))}
                <button onClick={() => up({ details: [...st.details, ""] })} className="mb-2 w-full rounded-xl border border-dashed py-2 text-[12px] font-bold" style={{ borderColor: C.goldDim, color: C.gold }}>＋ 粒を増やす</button>
                <button onClick={() => up({ step: 4 })} disabled={!detailsOk} className="w-full rounded-xl py-3 text-[14px] font-extrabold disabled:opacity-30" style={{ background: C.gold, color: "#0E1230" }}>
                  {detailsOk ? "確定と封印へ →" : "粒が3つ揃うと、先へ進める"}
                </button>
              </div>
            )}

            {/* ── 第4幕 確定と封印 ── */}
            {st.step === 4 && (
              <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div className="mincho mb-1 text-[14px] font-bold tracking-[2px]" style={{ color: C.gold }}>第4幕 — 確定と封印</div>
                <div className="mb-2 rounded-xl p-2.5 text-[11.5px] leading-relaxed" style={{ background: "#141838", color: C.sub }}>
                  核: <span style={{ color: C.ink }}>{st.core}</span>
                  <br />粒: {st.details.filter((d) => d.trim()).join(" ／ ")}
                </div>
                <p className="mb-1.5 text-[12px]" style={{ color: C.sub }}>材料を一望して、ちょっと背伸びした一文にまとめる。</p>
                <textarea
                  value={st.ddp}
                  onChange={(e) => up({ ddp: e.target.value })}
                  rows={4}
                  className={inputCls + " mincho text-[15px] leading-relaxed"}
                  style={inputStyle}
                  placeholder="12月21日、私は——"
                />
                <button onClick={runAi} disabled={aiBusy || !st.ddp.trim()} className="mt-2.5 w-full rounded-xl border py-2.5 text-[12.5px] font-bold disabled:opacity-30" style={{ borderColor: C.goldDim, color: C.gold }}>
                  {aiBusy ? "審査中…" : "AI関門審査（手段性・時間性・自己中心性・積み重ね）"}
                </button>
                {st.ai && (
                  <div className="mt-2 rounded-xl border p-3" style={{ borderColor: st.ai.pass ? C.ok : C.warn, background: st.ai.pass ? "#16281f" : "#2d1a22" }}>
                    <div className="text-[12px] font-bold" style={{ color: st.ai.pass ? C.ok : C.warn }}>{st.ai.pass ? "✓ 通過" : "△ 要見直し"}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: C.ink }}>{st.ai.comment}</p>
                    {st.ai.polished && (
                      <button onClick={() => up({ ddp: st.ai!.polished })} className="mincho mt-2 w-full rounded-lg border p-2.5 text-left text-[13px] leading-relaxed" style={{ borderColor: C.goldDim, color: C.ink }}>
                        「{st.ai.polished}」<span className="block pt-1 text-right text-[10px]" style={{ color: C.gold }}>タップで採用</span>
                      </button>
                    )}
                  </div>
                )}
                <button onClick={seal} disabled={!st.ddp.trim()} className="mincho mt-3 w-full rounded-xl py-3.5 text-[15px] font-bold tracking-[3px] disabled:opacity-30" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`, color: "#0E1230" }}>
                  このDDPで確定する
                </button>
                <p className="mt-1.5 text-center text-[10.5px]" style={{ color: C.sub }}>
                  確定するとマイページの一番上に表示されます（いつでも書き直せます）
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
