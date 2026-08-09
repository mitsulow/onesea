"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isTalkAdmin } from "@/lib/line";
import { srcCdn, uploadImage } from "@/lib/images";
import { PREFS } from "@/lib/sekai";
import TopTone from "@/components/TopTone";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/** ヒアリング回答の見出しラベル(主要項目のみ表示) */
const H_LABELS: Array<[string, string]> = [
  ["tanbo_name", "田んぼの名称"],
  ["pref", "都道府県"],
  ["address", "所在地"],
  ["map_link", "地図/住所"],
  ["size", "広さ"],
  ["method", "栽培方法"],
  ["crops", "栽培品目"],
  ["who", "お米づくりをする人"],
  ["years", "経験年数"],
  ["beginner", "初心者受け入れ"],
  ["busy", "繁忙期"],
  ["niiname", "新嘗祭のお裾分け"],
  ["feeling", "現在のお気持ち"],
];

/**
 * 事務局 > 米部 —「田んぼ待ち」受信箱。
 * ①田んぼを使って欲しい(初期申請) と ②ヒアリングシート を1人分にまとめて表示。
 * 自動で入る情報は先に登録フォームへ下書きし、事務局が写真追加・名前調整をして
 * 「田んぼを本登録」→ セカイムラ米部に田んぼページが誕生する。
 */
export default function OfficeKomePage() {
  const [me, setMe] = useState<User | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [hearings, setHearings] = useState<any[]>([]);
  const [showDone, setShowDone] = useState(false);
  // 本登録フォーム(待ちアイテムごとに開く)
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rName, setRName] = useState("");
  const [rPref, setRPref] = useState("東京都");
  const [rNote, setRNote] = useState("");
  const [rPhoto, setRPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: ap }, { data: kh }] = await Promise.all([
      supabase.from("tanbo_applications").select("*, profiles!tanbo_applications_user_id_fkey(username, display_name, avatar_url)").order("created_at", { ascending: false }).limit(200),
      supabase.from("kome_hearing").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setApps(ap ?? []);
    setHearings(kh ?? []);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) { setOk(false); return; }
      const admin = await isTalkAdmin(u.id);
      setOk(admin);
      if (admin) load();
    });
  }, [load]);

  if (ok === null) return <main className="p-8 text-center text-sm text-[#999]">確認中…</main>;
  if (!ok)
    return (
      <main className="p-8 text-center">
        <p className="text-sm text-[#666]">このページは事務局メンバーだけが開けます</p>
        <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#c94d3a] underline">OneSeaトップへ</Link>
      </main>
    );

  /* ①申請と②ヒアリングを本人(user_id、無ければメール)でまとめて「田んぼ待ち」に */
  type Wait = { key: string; app: any | null; hearing: any | null; done: boolean };
  const byKey = new Map<string, Wait>();
  const keyOf = (r: any) => r.user_id ?? `mail:${(r.email ?? "").toLowerCase()}`;
  for (const a of apps) {
    const k = keyOf(a);
    const w = byKey.get(k) ?? { key: k, app: null, hearing: null, done: true };
    if (!w.app || a.status === "pending") w.app = w.app && w.app.status === "pending" ? w.app : a;
    byKey.set(k, w);
  }
  for (const h of hearings) {
    const k = keyOf(h);
    const w = byKey.get(k) ?? { key: k, app: null, hearing: null, done: true };
    if (!w.hearing || h.status === "pending") w.hearing = w.hearing && w.hearing.status === "pending" ? w.hearing : h;
    byKey.set(k, w);
  }
  const waits = [...byKey.values()].map((w) => ({
    ...w,
    done: (w.app ? w.app.status !== "pending" : true) && (w.hearing ? w.hearing.status !== "pending" : true),
  }));
  const pending = waits.filter((w) => !w.done);
  const doneList = waits.filter((w) => w.done);
  const shown = showDone ? doneList : pending;

  const openRegister = (w: Wait) => {
    const h = w.hearing; const a = w.app;
    setOpenKey(w.key);
    const hAns = (h?.answers ?? {}) as Record<string, any>;
    setRName(hAns.tanbo_name || a?.tanbo_name || `${h?.name ?? a?.applicant_name ?? ""}さんの田んぼ`);
    const pf = (hAns.pref as string) || a?.prefecture || "東京都";
    setRPref(PREFS.includes(pf as any) ? pf : "東京都");
    const noteBits = [
      hAns.method ? `${hAns.method}` : null,
      hAns.size ? `広さ: ${hAns.size}` : null,
      hAns.crops ? `栽培: ${hAns.crops}` : null,
      hAns.address || (a ? `${a.prefecture}${a.city}` : null),
    ].filter(Boolean);
    setRNote(noteBits.join(" / "));
    setRPhoto(null);
  };

  const register = async (w: Wait) => {
    if (busy) return;
    if (!rName.trim()) { alert("田んぼの名前を入れてください"); return; }
    if (!confirm(`「${rName.trim()}」を米部に本登録しますか？（申請者が田守になります）`)) return;
    setBusy(true);
    const { data: newId, error } = await createClient().rpc("office_register_tanbo2", {
      p_app: w.app?.id ?? null,
      p_hearing: w.hearing?.id ?? null,
      p_name: rName.trim(),
      p_pref: rPref,
      p_note: rNote.trim(),
      p_photo: rPhoto ?? "",
    });
    setBusy(false);
    if (error || !newId) { alert("登録できませんでした: " + (error?.message ?? "")); return; }
    setOpenKey(null);
    alert("田んぼを本登録しました🌾 セカイムラ米部に載っています");
    load();
    window.open(`/sekai/kome/${newId}`, "_blank");
  };

  return (
    <main className="pb-24" style={{ background: "#f7f4ec", minHeight: "100dvh" }}>
      <TopTone color="#1a2432" />
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5" style={{ background: "#1a2432" }}>
        <Link href="/office" className="text-[15px] font-bold text-[#d4b96a] no-underline">◀</Link>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-tight text-[#f0e6c8]">事務局 — 米部 🌾 田んぼ待ち</div>
          <div className="text-[10px] text-[#7a9ab4]">①使って欲しい申請＋②ヒアリングシートを確認して本登録</div>
        </div>
        <AvatarMenu />
      </header>

      <div className="mx-auto max-w-md space-y-3 px-3 pt-4">
        <div className="flex gap-2">
          <button onClick={() => setShowDone(false)} className="flex-1 rounded-full py-2 text-[12px] font-extrabold" style={!showDone ? { background: "#a08a30", color: "#fff" } : { background: "#fff", color: "#a09060", border: "1px solid #e5dcc8" }}>田んぼ待ち {pending.length}件</button>
          <button onClick={() => setShowDone(true)} className="flex-1 rounded-full py-2 text-[12px] font-extrabold" style={showDone ? { background: "#a08a30", color: "#fff" } : { background: "#fff", color: "#a09060", border: "1px solid #e5dcc8" }}>本登録済み {doneList.length}件</button>
        </div>

        {shown.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-[#a09a88]">{showDone ? "本登録済みはまだありません" : "田んぼ待ちはありません🌾"}</p>
        ) : (
          shown.map((w) => {
            const a = w.app; const h = w.hearing;
            const prof = a?.profiles;
            const dispName = h?.name ?? a?.applicant_name ?? "—";
            const hAns = (h?.answers ?? {}) as Record<string, any>;
            return (
              <div key={w.key} className="rounded-2xl bg-white p-3.5" style={{ border: "1px solid #e5dcc8" }}>
                <div className="flex items-center gap-2.5">
                  {prof?.avatar_url ? <img src={srcCdn(prof.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2edda] text-[15px]">🌾</span>}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-[#3a3428]">{dispName}</div>
                    <div className="mt-0.5 flex gap-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${a ? "bg-[#e8f0e0] text-[#2a7a48]" : "bg-[#f0f0f0] text-[#b0aca0]"}`}>①申請{a ? "あり" : "なし"}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${h ? "bg-[#e8f0e0] text-[#2a7a48]" : "bg-[#fdf2e0] text-[#c08a30]"}`}>②ヒアリング{h ? "あり" : "待ち"}</span>
                    </div>
                  </div>
                  {w.done && <span className="flex-shrink-0 rounded-full bg-[#e8f4ec] px-2 py-0.5 text-[10px] font-bold text-[#2a7a48]">✓ 本登録済み</span>}
                </div>

                {a && (
                  <div className="mt-2 space-y-0.5 rounded-xl bg-[#faf8f0] p-2.5 text-[12px] leading-relaxed text-[#4a4438]">
                    <div className="text-[10px] font-extrabold text-[#a09060]">① 使って欲しい申請</div>
                    <div>📱 {a.phone} ／ ✉️ {a.email}</div>
                    <div>📍 {a.prefecture}{a.city} ／ 作り手: {a.farmer_who} ／ {a.farmer_type}</div>
                  </div>
                )}
                {h && (
                  <div className="mt-2 space-y-0.5 rounded-xl bg-[#f4faf0] p-2.5 text-[12px] leading-relaxed text-[#4a4438]">
                    <div className="text-[10px] font-extrabold text-[#2a7a48]">② ヒアリングシート</div>
                    <div>📱 {h.phone} ／ ✉️ {h.email}</div>
                    {H_LABELS.map(([k, l]) => hAns[k] ? <div key={k}>{l}: <b>{Array.isArray(hAns[k]) ? (hAns[k] as string[]).join("・") : String(hAns[k])}</b></div> : null)}
                  </div>
                )}

                {!w.done && (openKey === w.key ? (
                  <div className="mt-2.5 rounded-xl border border-[#e0d8b8] bg-[#fdfcf6] p-2.5">
                    <div className="mb-1 text-[11px] font-bold text-[#8a7020]">田んぼの名前</div>
                    <input value={rName} onChange={(e) => setRName(e.target.value)} className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[13.5px] outline-none" />
                    <div className="mb-1 text-[11px] font-bold text-[#8a7020]">都道府県</div>
                    <select value={rPref} onChange={(e) => setRPref(e.target.value)} className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-2 py-2 text-[13px] outline-none">
                      {PREFS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <div className="mb-1 text-[11px] font-bold text-[#8a7020]">ひとこと（ページに表示・自動下書き済み）</div>
                    <textarea value={rNote} onChange={(e) => setRNote(e.target.value)} rows={2} className="mb-2 w-full resize-y rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[12.5px] outline-none" />
                    <div className="mb-2 flex items-center gap-2">
                      {rPhoto && <img src={srcCdn(rPhoto)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8e2cc] bg-white px-3 py-2 text-[12px] font-bold text-[#8a7020]">
                        {rPhoto ? "📷 写真を変える" : "📷 写真を入れる"}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setRPhoto(await uploadImage("post-images", me.id, f, 1600, 0.75)); }} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setOpenKey(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a09a88]">とじる</button>
                      <button onClick={() => register(w)} disabled={busy || !rName.trim()} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#2a7a48" }}>{busy ? "登録中..." : "🌾 田んぼを本登録"}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => openRegister(w)} className="mt-2.5 w-full rounded-xl border-2 border-dashed py-2.5 text-[13px] font-extrabold" style={{ borderColor: "#a08a3066", color: "#8a7020" }}>
                    🌾 田んぼを本登録する（内容は自動で下書き済み）
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
