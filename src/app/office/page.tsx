"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isTalkAdmin, sendBroadcast } from "@/lib/line";
import TopTone from "@/components/TopTone";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/**
 * 事務局ページ — talk_admins（マスター・西田あかね・マチルダ）だけが開ける。
 * ① 会員へ一斉送信（わらわ〜のみ / 全員）
 * ② セカイムラ拠点申請（村の種）の認定
 * ③ 削除依頼（通報）の受信箱
 */
export default function OfficePage() {
  const [me, setMe] = useState<User | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "warawa">("all");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [seeds, setSeeds] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  const load = async (uid: string) => {
    const supabase = createClient();
    const [sd, rp] = await Promise.all([
      supabase.from("village_seeds").select("id, name, prefecture, city, status, created_at, village_seed_members(user_id)").eq("status", "open").order("created_at", { ascending: true }),
      supabase.from("post_reports").select("*, profiles!post_reports_reporter_fkey(display_name)").order("created_at", { ascending: false }).limit(100),
    ]);
    setSeeds(sd.data ?? []);
    if (rp.error) {
      // reporter の FK 名が違う場合は join なしで
      const { data } = await supabase.from("post_reports").select("*").order("created_at", { ascending: false }).limit(100);
      setReports(data ?? []);
    } else {
      setReports(rp.data ?? []);
    }
    void uid;
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) { setOk(false); return; }
      const admin = await isTalkAdmin(u.id);
      setOk(admin);
      if (admin) load(u.id);
    });
  }, []);

  if (ok === null) return <main className="p-8 text-center text-sm text-[#999]">確認中…</main>;
  if (!ok)
    return (
      <main className="p-8 text-center">
        <p className="text-sm text-[#666]">このページは事務局メンバーだけが開けます</p>
        <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#c94d3a] underline">OneSeaトップへ</Link>
      </main>
    );

  return (
    <main className="pb-24" style={{ background: "#f7f4ec", minHeight: "100dvh" }}>
      <TopTone color="#1a2432" />
      <header className="sticky top-0 z-40" style={{ background: "#1a2432" }}>
        <div className="flex h-[52px] items-center justify-between px-4">
          <span className="text-[17px] font-extrabold tracking-[3px] text-[#f0e6c8]">
            <img src="/icons/icon-megaphone.webp" alt="" style={{ width: 20, height: 20, display: "inline", verticalAlign: -4 }} /> 事務局
          </span>
          <AvatarMenu ring="#d4b96a" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px] space-y-4 px-4 pt-4">
        {/* ① 一斉送信 */}
        <section className="rounded-2xl bg-white p-4" style={{ border: "1px solid #e5dcc8" }}>
          <div className="mb-2 text-[13px] font-extrabold tracking-[2px] text-[#1a2432]">■ 会員へ一斉送信</div>
          <div className="mb-2 flex gap-2">
            {([["all", "全員（無料会員も含む）"], ["warawa", "わらわ〜会員だけ"]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAudience(v)}
                className="flex-1 rounded-xl border px-2 py-2 text-[11.5px] font-bold"
                style={
                  audience === v
                    ? { background: "#1a2432", color: "#f0e6c8", borderColor: "#1a2432" }
                    : { background: "#fff", color: "#8a8070", borderColor: "#e5dcc8" }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="お知らせの本文…（TalKの「お知らせ」に届きます。全員宛はプッシュ通知も飛びます）"
            className="w-full rounded-xl border border-[#e5dcc8] bg-[#fffdf8] p-3 text-[13.5px] outline-none focus:border-[#c94d3a]"
          />
          <button
            disabled={!body.trim() || sending}
            onClick={async () => {
              if (!me || !body.trim()) return;
              if (!confirm(`${audience === "all" ? "全員" : "わらわ〜会員だけ"}に送信します。よろしいですか？`)) return;
              setSending(true);
              const { error } = await sendBroadcast(me.id, body.trim(), audience);
              setSending(false);
              if (error) { alert(`送信できませんでした: ${error.message}`); return; }
              setBody("");
              setSent(`送信しました（宛先: ${audience === "all" ? "全員" : "わらわ〜会員"}）`);
              setTimeout(() => setSent(""), 4000);
            }}
            className="mt-2 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {sending ? "送信中…" : "一斉送信する"}
          </button>
          {sent && <p className="mt-1.5 text-center text-[12px] font-bold text-[#2a7a4a]">{sent}</p>}
        </section>

        {/* ② 拠点申請の認定 */}
        <section className="rounded-2xl bg-white p-4" style={{ border: "1px solid #e5dcc8" }}>
          <div className="mb-2 text-[13px] font-extrabold tracking-[2px] text-[#1a2432]">■ セカイムラ拠点申請</div>
          {seeds.length === 0 ? (
            <p className="py-1 text-[12.5px] text-[#a09888]">いま審査待ちの村の種はありません</p>
          ) : (
            seeds.map((sd) => {
              const n = (sd.village_seed_members ?? []).length;
              const ready = n >= 3;
              return (
                <div key={sd.id} className="flex items-center gap-2 border-b border-[#f0ece0] py-2.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-[#3a3428]">{sd.name}</div>
                    <div className="text-[11px] text-[#a09888]">
                      {sd.prefecture}{sd.city ? ` ${sd.city}` : ""} ・ メンバー {n}人{ready ? "" : "（あと" + (3 - n) + "人で認定可）"}
                    </div>
                  </div>
                  <button
                    disabled={!ready}
                    onClick={async () => {
                      if (!confirm(`「${sd.name}」を正式なセカイムラ拠点として認定しますか？`)) return;
                      const supabase = createClient();
                      const { error } = await supabase.rpc("promote_seed", { seed: sd.id });
                      if (error) { alert(`認定できませんでした: ${error.message}`); return; }
                      alert("認定しました！全国セカイムラ一覧に並びます");
                      if (me) load(me.id);
                    }}
                    className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-extrabold text-white disabled:opacity-35"
                    style={{ background: "#2a7a4a" }}
                  >
                    認定する
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* ③ 削除依頼（通報） */}
        <section className="rounded-2xl bg-white p-4" style={{ border: "1px solid #e5dcc8" }}>
          <div className="mb-2 text-[13px] font-extrabold tracking-[2px] text-[#1a2432]">
            ■ 削除依頼（通報）
            {reports.filter((r) => r.status === "open").length > 0 && (
              <span className="ml-2 rounded-full bg-[#e05040] px-2 py-0.5 text-[10.5px] font-bold text-white">
                {reports.filter((r) => r.status === "open").length}件
              </span>
            )}
          </div>
          {reports.length === 0 ? (
            <p className="py-1 text-[12.5px] text-[#a09888]">削除依頼はありません</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="border-b border-[#f0ece0] py-2.5 last:border-b-0" style={{ opacity: r.status === "open" ? 1 : 0.45 }}>
                <div className="flex items-center gap-2 text-[11px] text-[#a09888]">
                  <span className="rounded bg-[#f0ece0] px-1.5 py-0.5 font-bold text-[#6a5a3a]">
                    {r.kind === "cotozute" ? "Cotozute" : "セカイムラ投稿"}
                  </span>
                  <span className="num">{new Date(r.created_at).toLocaleDateString("ja-JP")}</span>
                  <span>依頼: {r.profiles?.display_name ?? "会員"}</span>
                  {r.status !== "open" && <span className="font-bold text-[#2a7a4a]">対応済み</span>}
                </div>
                {r.reason && <div className="mt-1 text-[12.5px] font-bold text-[#c94d3a]">理由: {r.reason}</div>}
                {r.excerpt && <div className="mt-0.5 line-clamp-2 text-[12px] text-[#5a5448]">「{r.excerpt}」</div>}
                <div className="mt-1.5 flex gap-2">
                  {r.target_url && (
                    <Link href={r.target_url} className="rounded-lg border border-[#e5dcc8] px-2.5 py-1 text-[11px] font-bold text-[#3070b0] no-underline">
                      投稿を見る →
                    </Link>
                  )}
                  {r.status === "open" && (
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from("post_reports").update({ status: "done" }).eq("id", r.id);
                        if (me) load(me.id);
                      }}
                      className="rounded-lg bg-[#2a7a4a] px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      対応済みにする
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <p className="pb-2 text-center text-[10.5px] text-[#a09888]">
          事務局メンバー: マスター・西田あかね・マチルダ（アカウント登録時に自動で権限が付きます）
        </p>
      </div>
    </main>
  );
}
