"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";
import { fetchMoais, createMoai, fetchMoaiFeed, moaiNameTaken, MOAI_CATEGORIES, moaiCat, type Moai } from "@/lib/moai";
import { PREFS } from "@/lib/sekai";
import { ServiceMenuButton } from "@/components/ServiceMenu";

/** MOAI 一覧 — MMM・セカイムラ横断の趣味サークル。誰でも作れて、誰でも入れる。 */
export default function MoaiListPage() {
  const [me, setMe] = useState<User | null>(null);
  const [moais, setMoais] = useState<Moai[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string>("music");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<any[] | null>(null);
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [pref, setPref] = useState("オンライン");
  const [city, setCity] = useState("");
  const [keywords, setKeywords] = useState("");
  const [policy, setPolicy] = useState<"open"|"approval">("open");
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => {
    if (pref === "オンライン" || pref === "海外") { setCities([]); setCity(pref); return; }
    fetch("/data-municipalities.json").then((r) => r.json()).then((muni) => {
      const arr = (muni[pref] ?? []).map((x: any) => x[0]);
      setCities(arr);
      if (!arr.includes(city)) setCity(arr[0] ?? "");
    }).catch(() => setCities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref]);
  const [q, setQ] = useState("");

  const load = () => { fetchMoais().then(setMoais); fetchMoaiFeed().then(setFeed); };
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) supabase.from("moai_members").select("moai_id").eq("user_id", u.id).then(({ data }) => setMyIds(new Set((data ?? []).map((r: any) => r.moai_id))));
    });
    load();
  }, []);

  const submit = async () => {
    if (!me || !name.trim() || busy) return;
    if (!city) { alert("主な活動場所（市町村）を選んでください"); return; }
    if (await moaiNameTaken(name)) { setNameTaken(true); return; }
    setBusy(true);
    const id = await createMoai(me.id, { name: name.trim(), category: cat, description: desc.trim() || null, keywords: keywords.trim() || null, join_policy: policy, prefecture: pref, city, icon_url: icon, cover_url: cover });
    setBusy(false);
    if (id) {
      window.location.href = `/moai/${id}`;
    } else {
      alert("作成できませんでした。もう一度お試しください");
    }
  };

  const up = async (f: File | null, set: (u: string | null) => void, big: boolean) => {
    if (!f || !me) return;
    const u = await uploadImage("post-images", me.id, f, big ? 1600 : 512, big ? 0.75 : 0.8);
    if (u) set(u);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-16" style={{ background: "#fbf7f5" }}>
      <IosBackButton />
      <header className="relative flex h-[52px] flex-col items-center justify-center border-b border-[#f0d8d4] px-6 text-center" style={{ background: "#fff" }}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2"><ServiceMenuButton /></span>
        <div className="text-[10px] tracking-[3px] text-[#a08078]">好きなことで、寄り集まろう。</div>
        <div className="text-[17px] font-extrabold tracking-[6px] text-[#3a2420]">MOAI</div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2"><AvatarMenu /></span>
      </header>

      <div className="px-3 pt-3">
        {/* サークルを探す */}
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="サークルを探す（名前・カテゴリ・キーワード）"
            className="w-full rounded-full border border-[#f0d8d4] bg-[#fff] py-2 pl-9 pr-9 text-[13px] text-[#3a2420] outline-none focus:border-[#c0392b]"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="消す" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#f0ece8] text-[12px] font-bold text-[#a08078]">×</button>
          )}
        </div>

        {/* 作成フォーム */}
        {me && creating && (
          <div className="mb-3 rounded-2xl p-3.5" style={{ background: "#ffffff", border: "1px solid #f0d8d4" }}>
            <div className="mb-2 text-[13px] font-extrabold text-[#3a2420]">MOAIをつくる</div>
            {/* カバー + アイコン */}
            <div className="relative mb-8 h-24 overflow-hidden rounded-xl bg-[#f6e4e0]">
              {cover ? <img src={srcCdn(cover)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[11px] text-[#b09088]">背景写真</div>}
              <label className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[13px] shadow">📷
                <input type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0] ?? null, setCover, true)} />
              </label>
              <label className="absolute -bottom-6 left-3 flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-[#fff] bg-[#f3ded9] text-[18px] shadow-lg">
                {icon ? <img src={srcCdn(icon)} alt="" className="h-full w-full object-cover" /> : "🗿"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0] ?? null, setIcon, false)} />
              </label>
            </div>
            <input value={name} onChange={(e) => { setName(e.target.value); setNameTaken(null); }} onBlur={async () => { if (name.trim()) setNameTaken(await moaiNameTaken(name)); }} placeholder="MOAIの名前（例: 朝ラン部、味噌づくりの会）" className="mb-1 w-full rounded-xl border bg-[#fff] px-3 py-2 text-[13.5px] text-[#3a2420] outline-none" style={{ borderColor: nameTaken ? "#c0392b" : "#f0d8d4" }} />
            {nameTaken === true && <p className="mb-2 text-[11px] font-bold text-[#c0392b]">⚠️ 同じ名前のMOAIが既にあります。別の名前にしてください</p>}
            {nameTaken === false && name.trim() && <p className="mb-2 text-[11px] font-bold text-[#2a8a4a]">✓ この名前は使えます</p>}
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="mb-2 w-full rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
              {MOAI_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <div className="mb-1 text-[11px] font-bold text-[#a08078]">参加のしかた</div>
            <div className="mb-2 flex gap-2">
              {([["open","誰でも参加OK"],["approval","承認制（OYAが承認）"]] as const).map(([v,l]) => (
                <button key={v} type="button" onClick={() => setPolicy(v)} className="flex-1 rounded-xl border-2 py-2 text-[12px] font-extrabold" style={policy===v ? {borderColor:"#c0392b",background:"#c0392b",color:"#fff"} : {borderColor:"#f0d8d4",color:"#a08078",background:"#fff"}}>{l}</button>
              ))}
            </div>
            <div className="mb-1 text-[11px] font-bold text-[#a08078]">主な活動場所（必須）</div>
            <div className="mb-2 flex gap-2">
              <select value={pref} onChange={(e) => setPref(e.target.value)} className="rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
                <option>オンライン</option>{PREFS.map((p) => <option key={p}>{p}</option>)}<option>海外</option>
              </select>
              {pref !== "オンライン" && pref !== "海外" && (
                <select value={city} onChange={(e) => setCity(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
                  {cities.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="どんな集まり？（ひとことでOK）" className="mb-2 w-full resize-y rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none focus:border-[#c0392b]" />
            <div className="mb-1 text-[11px] font-bold text-[#a08078]">検索キーワード（できる限り沢山！）</div>
            <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={2} placeholder="例: ランニング マラソン 朝活 健康 ダイエット 皇居 5km 初心者歓迎 …（スペースや「、」区切りで沢山）" className="mb-1 w-full resize-y rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none focus:border-[#c0392b]" />
            <p className="mb-2 text-[10px] text-[#b09088]">※ ここに書いた言葉で検索に引っかかりやすくなります</p>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a08078]">キャンセル</button>
              <button onClick={submit} disabled={!name.trim() || busy || nameTaken === true} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c0392b" }}>{busy ? "作成中..." : "つくる"}</button>
            </div>
          </div>
        )}

        {!me && (
          <p className="mb-3 rounded-xl bg-[#faf4f2] px-4 py-3 text-center text-[12px] text-[#a08078]">
            <Link href="/" className="font-bold text-[#c0392b] underline">ログイン</Link>すると、MOAIを作ったり参加できます
          </p>
        )}

        {/* サークル横スクロール（先頭に「MOAIをつくる」カード・セカイムラのイベント作成と同じ流儀） */}
        <div className="hide-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1">
          {me && (
            <button
              onClick={() => setCreating(true)}
              className="flex w-[110px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed py-5"
              style={{ borderColor: "#c0392b", background: "rgba(200,60,50,.06)" }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] font-extrabold text-white" style={{ background: "#c0392b" }}>＋</span>
              <span className="px-1 text-center text-[10.5px] font-extrabold leading-snug text-[#c0392b]">MOAIを<br />つくる</span>
            </button>
          )}
          {(moais ?? []).filter((m) => {
            const k = q.trim().toLowerCase();
            if (!k) return true;
            return (m.name ?? "").toLowerCase().includes(k) || (m.description ?? "").toLowerCase().includes(k) || ((m as any).keywords ?? "").toLowerCase().includes(k) || (moaiCat(m.category).label ?? "").toLowerCase().includes(k) || ((m as any).prefecture ?? "").toLowerCase().includes(k) || ((m as any).city ?? "").toLowerCase().includes(k);
          }).map((m) => (
            <Link key={m.id} href={`/moai/${m.id}`} className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl no-underline shadow-md" style={{ background: "#ffffff", border: "1px solid #f0d8d4" }}>
              <div className="relative h-20 bg-[#f6e4e0]">
                {m.cover_url ? <img src={srcCdn(m.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[22px]">{moaiCat(m.category).emoji}</div>}
                <span className="absolute -bottom-4 left-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#fff] bg-[#f3ded9] text-[15px]">
                  {m.icon_url ? <img src={srcCdn(m.icon_url)} alt="" className="h-full w-full object-cover" /> : "🗿"}
                </span>
              </div>
              <div className="px-2.5 pb-2 pt-5">
                <div className="truncate text-[13px] font-extrabold text-[#3a2420]">{m.name}</div>
                {myIds.has(m.id)
                  ? <div className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold" style={{ borderColor: "#c0392b", color: "#c0392b" }}>✓ 参加中</div>
                  : <div className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-extrabold text-white" style={{ background: "#c0392b" }}>入部希望 →</div>}
                <div className="mt-0.5 truncate text-[10px] text-[#b09088]">
                  {moaiCat(m.category).label}{m.moai_members?.[0]?.count ? ` ・ ${m.moai_members[0].count}人` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 全サークル横断の活動フィード */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-[13px] font-extrabold tracking-[2px] text-[#c0392b]">みんなのMOAI活動</span>
            <span className="h-px flex-1" style={{ background: "#f0d8d4" }} />
          </div>
          {feed === null ? (
            <p className="py-4 text-center text-[12px] text-[#b09088]">読み込み中...</p>
          ) : feed.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[#b09088]">まだ投稿がありません</p>
          ) : (
            <div className="space-y-2.5">
              {feed.map((p: any) => (
                <Link key={p.id} href={`/moai/${p.moai_id}`} className="block rounded-xl p-3 no-underline" style={{ background: "#ffffff", border: "1px solid #f0d8d4" }}>
                  <div className="flex items-center gap-2.5">
                    {p.moai?.icon_url ? (
                      <img src={srcCdn(p.moai.icon_url)} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f3ded9] text-[15px]">{moaiCat(p.moai?.category ?? null).emoji}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[#3a2420]">{p.moai?.name ?? "MOAI"}<span className="text-[11px] font-normal text-[#b09088]">からの投稿</span></div>
                      <div className="num text-[10px] text-[#b09088]">{p.profiles?.display_name ?? "メンバー"} ・ {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}</div>
                    </div>
                    {p.kind === "event" && p.event_at && (
                      <span className="num flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(200,60,50,.14)", color: "#c0392b" }}>📅 {new Date(p.event_at).getMonth() + 1}/{new Date(p.event_at).getDate()}</span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#4a3630]">{p.body}</p>
                  {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-2 max-h-72 w-full rounded-xl object-cover" />}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
