"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";

const GOLD = "#d4b96a";

/** 県別交流 — 47都道府県のチャットルーム一覧(MMM) */
export default function KouryuListPage() {
  const [rooms, setRooms] = useState<any[] | null>(null);
  const [myPref, setMyPref] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.from("pref_rooms").select("id, prefecture, sort").order("sort").then(({ data }) => setRooms(data ?? []));
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
    <main className="mx-auto min-h-dvh max-w-md pb-20" style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}>
      <IosBackButton />
      <header className="relative flex h-[52px] flex-col items-center justify-center border-b border-[#2a4a63] px-6 text-center">
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
          <div className="grid grid-cols-3 gap-2">
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
