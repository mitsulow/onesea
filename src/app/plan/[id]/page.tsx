"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { PlaceOverlay, type PlaceInfo } from "@/components/PlaceOverlay";
import { readTecho, writeTecho } from "@/lib/techoStore";

const YOBI = ["日", "月", "火", "水", "木", "金", "土"];

/** シェアされた予定 — 「手帳に追加」で拠点イベントと同じスムーズさで自分の手帳へ */
export default function SharedPlanPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const [plan, setPlan] = useState<any | null | undefined>(undefined);
  const [creator, setCreator] = useState<any | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("shared_plans").select("*").eq("id", planId).maybeSingle().then(async ({ data }) => {
      setPlan(data ?? null);
      if (data?.creator) {
        const { data: p } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", data.creator).maybeSingle();
        setCreator(p);
      }
    });
    // すでに手帳に入っているか
    try {
      const memos = JSON.parse(readTecho());
      for (const k of Object.keys(memos)) {
        if ((memos[k]?.ev ?? []).some((e: any) => e.id === `share-${planId}`)) { setAdded(true); break; }
      }
    } catch {}
  }, [planId]);

  const addToTecho = () => {
    if (!plan) return;
    try {
      const d = new Date(plan.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const memos = JSON.parse(readTecho());
      const day = memos[key] ?? { note: "", h: {} };
      day.ev = day.ev ?? [];
      const evId = `share-${planId}`;
      if (!day.ev.some((x: any) => x.id === evId)) {
        const de = plan.end_at ? new Date(plan.end_at) : null;
        const sameDay = de && de.toDateString() === d.toDateString();
        day.ev.push({
          id: evId, sh: d.getHours(), sm: d.getMinutes(),
          eh: sameDay ? de!.getHours() : Math.min(23, d.getHours() + 1),
          em: sameDay ? de!.getMinutes() : d.getMinutes(),
          text: plan.title,
          color: "red",
          detail: plan.detail ?? undefined,
          plan: planId,
          place: (plan.place_lat != null || plan.place_name)
            ? { name: plan.place_name ?? null, lat: plan.place_lat ?? null, lng: plan.place_lng ?? null, url: plan.place_url ?? null }
            : undefined,
        });
        day.ev.sort((a: any, b: any) => a.sh * 60 + a.sm - (b.sh * 60 + b.sm));
        memos[key] = day;
        writeTecho(JSON.stringify(memos));
      }
      setAdded(true);
    } catch {
      alert("手帳に追加できませんでした。もう一度お試しください");
    }
  };

  if (plan === undefined) return <main className="min-h-dvh bg-[#f7f4ec]"><p className="pt-24 text-center text-[13px] text-[#a09a88]">読み込み中...</p></main>;
  if (plan === null) return <main className="min-h-dvh bg-[#f7f4ec] px-6 pt-24 text-center"><p className="text-[14px] font-bold text-[#5a5448]">この予定は見つかりませんでした</p><Link href="/" className="mt-4 inline-block text-[13px] font-bold text-[#c94d3a] underline">OneSeaトップへ</Link></main>;

  const d = new Date(plan.at);
  const de = plan.end_at ? new Date(plan.end_at) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-24 pt-8" style={{ background: "#f7f4ec" }}>
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #e8e2d4" }}>
        <div className="flex items-center gap-2.5">
          {creator?.avatar_url
            ? <img src={srcCdn(creator.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
            : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0e8d8] text-[15px]">📔</span>}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-[#a09a88]"><b className="text-[#5a5448]">{creator?.display_name ?? "どなたか"}</b> さんから予定のおさそい</div>
          </div>
        </div>

        <h1 className="mt-4 text-[20px] font-extrabold leading-snug text-[#3a3428]">{plan.title}</h1>
        <div className="num mt-2 text-[15px] font-bold text-[#c94d3a]">
          {d.getMonth() + 1}月{d.getDate()}日（{YOBI[d.getDay()]}）{d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}
          {de && ` 〜 ${de.getHours()}:${String(de.getMinutes()).padStart(2, "0")}`}
        </div>

        {plan.detail && (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-[#faf7f0] p-3 text-[13.5px] leading-relaxed text-[#5a5448]">{plan.detail}</p>
        )}

        {(plan.place_name || plan.place_lat != null) && (
          <button
            onClick={() => setPlace({ name: plan.place_name, lat: plan.place_lat, lng: plan.place_lng, url: plan.place_url })}
            className="mt-3 flex w-full items-center gap-2 rounded-xl border border-[#e0d8c8] bg-white px-3 py-2.5 text-left"
          >
            <span className="text-[16px]">📍</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#3a3428]">{plan.place_name ?? "地図を見る"}</span>
            <span className="flex-shrink-0 text-[11px] font-bold text-[#c94d3a]">地図 →</span>
          </button>
        )}

        <button
          onClick={addToTecho}
          disabled={added}
          className="mt-5 w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60"
          style={{ background: added ? "#7ba05b" : "#c94d3a" }}
        >
          {added ? "✓ 手帳に追加済み" : "📔 手帳に追加"}
        </button>
        {added && (
          <Link href="/" className="mt-2 block py-2 text-center text-[12.5px] font-bold text-[#8a7a5a] no-underline">手帳を見る →</Link>
        )}
      </div>
      <p className="mt-3 text-center text-[10.5px] text-[#b0a898]">追加すると、あなたの手帳のその日に予定と地図が入ります</p>
      {place && <PlaceOverlay place={place} onClose={() => setPlace(null)} />}
    </main>
  );
}
