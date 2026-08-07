"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import {
  NEURA_SIZE,
  NeuraTeam,
  fetchMyDdp,
  myNeuraTeam,
  joinNeura,
  leaveNeura,
} from "@/lib/mmm";

/* eslint-disable @next/next/no-img-element */

/** 🧠 ニューラFIVE — 同じ町の5人1チーム。冬至までに他の4人のDDPを叶える */
export default function NeuraPage() {
  const [me, setMe] = useState<User | null>(null);
  const [myPref, setMyPref] = useState("");
  const [myCity, setMyCity] = useState<string | null>(null);
  const [myDdp, setMyDdp] = useState("");
  const [team, setTeam] = useState<NeuraTeam | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) {
        setTeam(null);
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("prefecture, city").eq("id", u.id).maybeSingle();
      setMyPref(prof?.prefecture ?? "");
      setMyCity(prof?.city ?? null);
      setMyDdp(await fetchMyDdp(u.id));
      setTeam(await myNeuraTeam(u.id));
    });
  }, []);

  const join = async () => {
    if (!me || joining || !myPref) return;
    setJoining(true);
    await joinNeura(me.id, myPref, myCity);
    setTeam(await myNeuraTeam(me.id));
    setJoining(false);
  };

  return (
    <main className="min-h-screen pb-24" style={{ background: "linear-gradient(180deg,#0a1410,#101a28)" }}>
      <header className="relative z-[60] flex items-center justify-center px-6 py-2" style={{ background: "#0a1410" }}>
        <span className="text-[16px] font-extrabold tracking-[3px]" style={{ color: "#a8b8f0", textShadow: "0 0 10px rgba(140,160,255,.6)" }}>
          <img src="/icons/icon-neura5.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> ニューラFIVE
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <AvatarMenu ring="#a8b8f0" />
        </span>
      </header>

      <section className="card" style={{ background: "linear-gradient(150deg,#101a28,#1a1a30)", border: "none" }}>
        <p className="text-[12.5px] leading-relaxed text-[#8a9ab8]">
          同じ町の5人でチームを組み、冬至までに<b className="text-[#c8d4f8]">他の4人のDDPを叶えてあげる</b>活動。
          あなたの役割は、自分のDDPを明確に持つこと。あなたの夢は、他の4人が叶えてくれる。
        </p>
        {!myDdp && (
          <Link
            href="/mmm/ddp"
            className="mt-2.5 block rounded-xl border border-[#2a4a3a] bg-[#0c1812] px-3 py-2.5 text-center text-[12.5px] font-bold text-[#7de0a0] no-underline"
          >
            <img src="/icons/icon-ddp.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> まずは自分のDDPを設定する →
          </Link>
        )}

        {team === undefined ? (
          <p className="py-3 text-[12px] text-[#5a6a8a]">読み込み中...</p>
        ) : team === null ? (
          me ? (
            <button
              onClick={join}
              disabled={joining || !myPref}
              className="mt-3 w-full rounded-xl py-3 text-[14px] font-extrabold text-[#101a28] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}
            >
              {joining ? "チームを探しています..." : `${myCity ?? myPref}のチームに参加する`}
            </button>
          ) : (
            <p className="mt-3 text-[12px] text-[#5a6a8a]">ログインすると参加できます</p>
          )
        ) : (
          <div className="mt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12.5px] font-extrabold text-[#c8d4f8]">
                <img src="/icons/icon-neura5.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> ニューラ班（{team.city ?? team.prefecture}）
              </span>
              <span className="num text-[10px] text-[#5a6a8a]">
                {team.members.length}/{NEURA_SIZE}人 ・ {team.season}
              </span>
            </div>
            <div className="space-y-1.5">
              {team.members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
                  {m.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#2a3a55]"><img src="/icons/icon-neura5.webp" alt="" style={{ width: 20, height: 20 }} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-[#c8d4f8]">
                      {m.profiles?.display_name ?? "メンバー"}
                      {m.user_id === me?.id && <span className="ml-1 text-[9px] text-[#8a9ab8]">（あなた）</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-[#e8ecff]">
                      {m.ddp ? <><img src="/icons/icon-ddp.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> {m.ddp}</> : <span className="text-[#4a5a78]">DDP未設定</span>}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, NEURA_SIZE - team.members.length) }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#2a3a55] px-2.5 py-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[13px] text-[#4a5a78]">＋</span>
                  <span className="text-[11.5px] text-[#4a5a78]">同じ町の仲間を待っています</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Link
                href={`/talk/g/neura/${team.id}`}
                className="flex-1 rounded-xl py-2.5 text-center text-[13px] font-extrabold text-[#101a28] no-underline"
                style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}
              >
                <img src="/icons/icon-chat.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 班のグループTALK
              </Link>
              <button
                onClick={async () => {
                  if (!me || !team) return;
                  if (!confirm("この班を抜けますか？")) return;
                  await leaveNeura(me.id, team.id);
                  setTeam(await myNeuraTeam(me.id));
                }}
                className="flex-shrink-0 rounded-xl border border-white/15 px-3 py-2.5 text-[11px] text-[#5a6a8a]"
              >
                抜ける
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
