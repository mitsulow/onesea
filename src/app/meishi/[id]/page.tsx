"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { getOrCreateChat } from "@/lib/line";
import { sendFriendRequest } from "@/lib/friends";

/** 📇 リアルで会った人との名刺交換 — QRを読み取るとこのページが開き、「交換する」でお互いフォロー+TalK開通 */
export default function MeishiExchangePage() {
  const params = useParams<{ id: string }>();
  const otherId = params.id;
  const router = useRouter();
  const [me, setMe] = useState<User | null | undefined>(undefined);
  const [other, setOther] = useState<any | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, prefecture, city, status_line, murabito")
      .eq("id", otherId)
      .maybeSingle()
      .then(({ data }) => setOther(data ?? null));
  }, [otherId]);

  const exchange = async () => {
    if (!me || busy) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("meishi_exchange", { p_other: otherId });
    if (error || data !== "ok") {
      setBusy(false);
      alert("名刺交換できませんでした。もう一度お試しください");
      return;
    }
    // 名刺交換したら ともだち申請（相手のTALKに申請カードが届く）
    try { await sendFriendRequest(me.id, otherId); } catch { /* 申請失敗しても交換自体は成立 */ }
    setBusy(false);
    setDone(true);
  };

  if (other === undefined) {
    return <main className="min-h-dvh bg-[#f7f4ec]"><p className="pt-24 text-center text-[13px] text-[#a09888]">読み込み中...</p></main>;
  }
  if (other === null) {
    return (
      <main className="min-h-dvh bg-[#f7f4ec] px-6 pt-24 text-center">
        <p className="text-[14px] font-bold text-[#5a5448]">この名刺は見つかりませんでした</p>
        <Link href="/" className="mt-4 inline-block text-[13px] font-bold text-[#c94d3a] underline">OneSeaトップへ</Link>
      </main>
    );
  }
  const isSelf = me?.id === other.id;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-24 pt-10" style={{ background: "#f7f4ec" }}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-md" style={{ border: "1px solid #e8e2d4" }}>
        {/* 名刺: カバー + アバター + 名前 */}
        <div className="h-[92px]" style={{ background: other.cover_url ? `url(${srcCdn(other.cover_url)}) center/cover` : "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }} />
        <div className="px-5 pb-5">
          <div className="-mt-9 flex items-end gap-3">
            {other.avatar_url
              ? <img src={srcCdn(other.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-[72px] w-[72px] rounded-full border-4 border-white object-cover shadow" />
              : <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-[#eef4ee] text-[26px] shadow">📔</span>}
            <div className="min-w-0 flex-1 pb-1">
              {other.murabito && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: "#e8f4ec", color: "#2a7a48", border: "1px solid #bcdcc8" }}>
                  セカイムラ{(other.prefecture ?? "").replace(/[都府県]$/, "")}村人
                </span>
              )}
            </div>
          </div>
          <h1 className="mt-2 text-[20px] font-extrabold text-[#3a3428]">{other.display_name ?? "むらびと"}</h1>
          {(other.prefecture || other.city) && (
            <div className="mt-0.5 text-[12px] text-[#a09888]">📍 {other.prefecture ?? ""}{other.city ? ` ${other.city}` : ""}</div>
          )}
          {other.status_line && <p className="mt-1 text-[13px] text-[#5a5448]">{other.status_line}</p>}

          {/* 交換ボタン */}
          {isSelf ? (
            <p className="mt-4 rounded-xl bg-[#faf7f0] px-3 py-2.5 text-[12px] leading-relaxed text-[#8a8070]">
              これはあなたの名刺です。リアルで会った人にQRを見せて読み取ってもらうと、この画面が相手に開きます
            </p>
          ) : done ? (
            <>
              <p className="mt-4 rounded-xl px-3 py-3 text-center text-[14px] font-extrabold" style={{ background: "#e8f4ec", color: "#2a7a48" }}>
                📇 名刺交換しました！お互いフォローになりました
              </p>
              <button
                onClick={async () => {
                  if (!me) return;
                  const chatId = await getOrCreateChat(me.id, other.id);
                  if (chatId) router.push(`/talk/${chatId}`);
                }}
                className="mt-2.5 w-full rounded-xl py-3 text-[14px] font-extrabold text-white"
                style={{ background: "#2a8a4a" }}
              >
                💬 TalKであいさつする
              </button>
              {other.username && (
                <Link href={`/u/${other.username}`} className="mt-2 block py-2 text-center text-[12.5px] font-bold text-[#8a7a5a] no-underline">
                  {other.display_name ?? "この人"}さんのマイページを見る →
                </Link>
              )}
            </>
          ) : me ? (
            <button
              onClick={exchange}
              disabled={busy}
              className="mt-4 w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#c94d3a" }}
            >
              {busy ? "交換中..." : "📇 名刺交換する"}
            </button>
          ) : me === null ? (
            <button
              onClick={async () => {
                try { localStorage.setItem("onesea-return", `/meishi/${otherId}`); } catch {}
                await createClient().auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/callback`, queryParams: { prompt: "select_account" } },
                });
              }}
              className="mt-4 block w-full rounded-xl py-3.5 text-center text-[14px] font-extrabold text-white"
              style={{ background: "#c94d3a" }}
            >
              Googleログインして名刺交換する
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[#b0a898]">
        名刺交換すると、お互いにフォローし合い、TalKで連絡できるようになります
      </p>
    </main>
  );
}
