"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";

const GOLD = "#d4b96a";

/** 県別交流 — 47都道府県のチャットルーム一覧(MMM) */
export default function KouryuListPage() {
  const [isWara, setIsWara] = useState(false);
  const [waraChecked, setWaraChecked] = useState(false);

  const [rooms, setRooms] = useState<any[] | null>(null);
  const [myPref, setMyPref] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});


  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) { setIsWara(false); setWaraChecked(true); return; }
      const [{ data: prof }, { data: adm }] = await Promise.all([
        supabase.from("profiles").select("warawa_until").eq("id", uid).maybeSingle(),
        supabase.from("talk_admins").select("user_id").eq("user_id", uid).maybeSingle(),
      ]);
      const { isWarawaUntil } = await import("@/lib/warawa");
      setIsWara(!!adm || isWarawaUntil(prof?.warawa_until as string | null));
      setWaraChecked(true);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("pref_rooms").select("id, prefecture, sort").eq("kind", "kouryu").order("sort").then(({ data }) => setRooms(data ?? []));
    supabase.from("pref_room_members").select("room_id").then(({ data }) => {
      const c: Record<string, number> = {};
      for (const r of data ?? []) c[r.room_id] = (c[r.room_id] ?? 0) + 1;
      setCounts(c);
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("prefecture").eq("id", uid).maybeSingle();
      if (p?.prefecture) setMyPref(p.prefecture);
    });
  }, []);

  const mine = (rooms ?? []).find((r) => r.prefecture === myPref);

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-20 lg:max-w-5xl" style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}>
      <IosBackButton />
      
      {waraChecked && !isWara && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 text-center">
            <div className="text-[36px]">🗾</div>
            <h2 className="mt-2 text-[16px] font-extrabold text-[#1c3448]">県別の交流は、わらわ〜会員のひろばです</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5a6a74]">同じ県の仲間との交流チャットは、有料のわらわ〜会員だけが使えます。わらわ〜会員になってご参加ください。</p>
            <a href="https://warawer.com" className="mt-4 block rounded-xl py-3 text-[13.5px] font-extrabold text-white no-underline" style={{ background: "#d4b96a", color: "#1c2432" }}>わらわ〜会員について →</a>
            <Link href="/mmm" className="mt-2 block py-2 text-[12px] font-bold text-[#8a9aa8] no-underline">MMMトップへ戻る</Link>
          </div>
        </div>
      )}
      <header className="relative flex h-[52px] flex-col items-center justify-center border-b border-[#2a4a63] px-6 text-center">
        <a href="/mmm" aria-label="MMMへ戻る" className="absolute left-2.5 top-1/2 z-20 flex h-[30px] -translate-y-1/2 items-center rounded-full border border-white/25 bg-white/10 px-3.5 text-[12px] font-bold text-[#e8d5a0] no-underline">戻る</a>
        <div className="text-[10px] tracking-[3px] text-[#7a9ab4]">同じ県の仲間と、つながろう。</div>
        <div className="text-[16px] font-extrabold tracking-[3px] text-[#f0e6c8]">県別の交流</div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2"><AvatarMenu /></span>
      </header>

      <div className="px-3 pt-3">
        {/* 自分の県へのショートカット */}
        {mine && (
          <Link href={`/mmm/kouryu/${mine.id}`} className="mb-3 flex items-center gap-3 rounded-2xl px-4 py-3.5 no-underline" style={{ background: "rgba(212,185,106,.14)", border: `1.5px solid ${GOLD}` }}>
            <span className="text-[22px]">🗾</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-extrabold" style={{ color: GOLD }}>{mine.prefecture}交流 — あなたの県</span>
              <span className="block text-[11px] text-[#a8c4d8]">{counts[mine.id] ?? 0}人が参加中。タップして話そう</span>
            </span>
            <span className="text-[16px]" style={{ color: GOLD }}>→</span>
          </Link>
        )}

        {rooms === null ? (
          <p className="py-8 text-center text-[12px] text-[#7a9ab4]">読み込み中...</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {rooms.map((r) => (
              <Link key={r.id} href={`/mmm/kouryu/${r.id}`} className="rounded-xl px-2 py-3 text-center no-underline" style={{ background: "rgba(255,255,255,.06)", border: "1px solid #2a4a63" }}>
                <span className="block text-[13px] font-bold text-[#e8f0f8]">{r.prefecture}</span>
                <span className="num block text-[10px] text-[#7a9ab4]">{counts[r.id] ? `${counts[r.id]}人` : "—"}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-[#5a7a94]">
          県のルームに入ると、TalKのグループ欄にも「◯◯県交流」が現れます。<br />どちらで話しても完全に同期します
        </p>
      </div>
    </main>
  );
}
