"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";
import { fetchMoais, createMoai, MOAI_CATEGORIES, moaiCat, type Moai } from "@/lib/moai";

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

  const load = () => fetchMoais().then(setMoais);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    load();
  }, []);

  const submit = async () => {
    if (!me || !name.trim() || busy) return;
    setBusy(true);
    const id = await createMoai(me.id, { name: name.trim(), category: cat, description: desc.trim() || null, icon_url: icon, cover_url: cover });
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
    <main className="mx-auto min-h-dvh max-w-md pb-16" style={{ background: "linear-gradient(180deg,#1a1530,#241a3e)" }}>
      <IosBackButton />
      <header className="relative flex h-[52px] flex-col items-center justify-center border-b border-[#4a3a6a] px-6 text-center" style={{ background: "#1a1530" }}>
        <div className="text-[10px] tracking-[3px] text-[#b8a8e0]">好きなことで、寄り集まろう。</div>
        <div className="text-[17px] font-extrabold tracking-[6px] text-[#eee6ff]">MOAI</div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2"><AvatarMenu /></span>
      </header>

      <div className="px-3 pt-3">
        {/* つくるボタン */}
        {me && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3.5 text-left"
            style={{ borderColor: "#7a5ac0", background: "rgba(122,90,192,.12)" }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-[20px] font-extrabold text-white" style={{ background: "#7a5ac0" }}>＋</span>
            <span>
              <span className="block text-[14px] font-extrabold text-[#eee6ff]">MOAIをつくる</span>
              <span className="block text-[11px] text-[#b8a8e0]">「こんな趣味の人あつまれ！」— 拠点づくりと同じ手軽さ</span>
            </span>
          </button>
        )}

        {/* 作成フォーム */}
        {me && creating && (
          <div className="mb-3 rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,.06)", border: "1px solid #4a3a6a" }}>
            <div className="mb-2 text-[13px] font-extrabold text-[#eee6ff]">MOAIをつくる</div>
            {/* カバー + アイコン */}
            <div className="relative mb-8 h-24 overflow-hidden rounded-xl bg-[#2a2048]">
              {cover ? <img src={srcCdn(cover)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[11px] text-[#9a8ac0]">背景写真</div>}
              <label className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[13px] shadow">📷
                <input type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0] ?? null, setCover, true)} />
              </label>
              <label className="absolute -bottom-6 left-3 flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-[#241a3e] bg-[#3a2a5e] text-[18px] shadow-lg">
                {icon ? <img src={srcCdn(icon)} alt="" className="h-full w-full object-cover" /> : "🗿"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0] ?? null, setIcon, false)} />
              </label>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="MOAIの名前（例: 朝ラン部、味噌づくりの会）" className="mb-2 w-full rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#9a7ae0]" />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="mb-2 w-full rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-2 py-2 text-[13px] text-white outline-none">
              {MOAI_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="どんな集まり？（ひとことでOK）" className="mb-2 w-full resize-y rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-3 py-2 text-[13px] text-white outline-none focus:border-[#9a7ae0]" />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#b8a8e0]">キャンセル</button>
              <button onClick={submit} disabled={!name.trim() || busy} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#7a5ac0" }}>{busy ? "作成中..." : "つくる"}</button>
            </div>
          </div>
        )}

        {!me && (
          <p className="mb-3 rounded-xl bg-white/5 px-4 py-3 text-center text-[12px] text-[#b8a8e0]">
            <Link href="/" className="font-bold text-[#c8b8f0] underline">ログイン</Link>すると、MOAIを作ったり参加できます
          </p>
        )}

        {/* 一覧 */}
        {moais === null ? (
          <p className="py-8 text-center text-[12px] text-[#9a8ac0]">読み込み中...</p>
        ) : moais.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[#9a8ac0]">まだMOAIがありません。最初のひとつを作ってみましょう</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {moais.map((m) => (
              <Link key={m.id} href={`/moai/${m.id}`} className="overflow-hidden rounded-2xl no-underline shadow-md" style={{ background: "rgba(255,255,255,.06)", border: "1px solid #4a3a6a" }}>
                <div className="relative h-20 bg-[#2a2048]">
                  {m.cover_url ? <img src={srcCdn(m.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[22px]">{moaiCat(m.category).emoji}</div>}
                  <span className="absolute -bottom-4 left-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#241a3e] bg-[#3a2a5e] text-[15px]">
                    {m.icon_url ? <img src={srcCdn(m.icon_url)} alt="" className="h-full w-full object-cover" /> : "🗿"}
                  </span>
                </div>
                <div className="px-2.5 pb-2 pt-5">
                  <div className="truncate text-[13px] font-extrabold text-[#eee6ff]">{m.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#a898d0]">
                    {moaiCat(m.category).label}{m.moai_members?.[0]?.count ? ` ・ ${m.moai_members[0].count}人` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
