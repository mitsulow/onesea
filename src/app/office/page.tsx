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
    let reps: any[] = [];
    if (rp.error) {
      const { data } = await supabase.from("post_reports").select("*").order("created_at", { ascending: false }).limit(100);
      reps = data ?? [];
    } else {
      reps = rp.data ?? [];
    }
    // 依頼者のアバター・名前・usernameをまとめて取得（マイページで人柄チェックできるように）
    const ids = Array.from(new Set(reps.map((r) => r.reporter).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
      const by = new Map((profs ?? []).map((pp: any) => [pp.id, pp]));
      reps = reps.map((r) => ({ ...r, reporterProf: by.get(r.reporter) ?? null }));
    }
    setReports(reps);
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

          {/* Gメールでも送る: 会員メールをBCCに詰めたGmail作成画面を開く（送信基盤いらず・無料） */}
          <button
            onClick={async () => {
              const supabase = createClient();
              const { data, error } = await supabase.rpc("office_member_emails", { aud: audience });
              if (error || !data?.length) { alert("メールアドレスを取得できませんでした"); return; }
              const emails = (data as Array<{ email: string }>).map((r) => r.email);
              const subject = encodeURIComponent("【OneSea事務局】お知らせ");
              const bodyEnc = encodeURIComponent(body.slice(0, 1500));
              // Gmailの作成画面はURL長に上限があるので50人ずつに分けて開く
              for (let i = 0; i < emails.length; i += 50) {
                const bcc = encodeURIComponent(emails.slice(i, i + 50).join(","));
                window.open(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subject}&body=${bodyEnc}`, "_blank");
              }
            }}
            className="mt-2 w-full rounded-xl border-2 py-2.5 text-[13px] font-extrabold"
            style={{ borderColor: "#c94d3a", color: "#c94d3a", background: "#fff" }}
          >
            ✉ Gメールでも送る（宛先BCCを自動セット）
          </button>
          <p className="mt-1 text-center text-[10px] text-[#a09888]">Gmailの作成画面が開きます。50人ごとに1通に分かれます</p>
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
            ([
              ["cotozute", "Cotozuteからの通報"],
              ["village_post", "セカイムラからの通報"],
              ["za", "楽市楽座からの通報"],
            ] as const).map(([kk, ktitle]) => {
              const list = reports.filter((r) => (kk === "village_post" ? r.kind !== "cotozute" && r.kind !== "za" : r.kind === kk));
              if (list.length === 0) return null;
              return (
                <div key={kk} className="mb-2">
                  <div className="mb-1 mt-2 border-b border-[#e5dcc8] pb-1 text-[12px] font-extrabold text-[#8a6a42]">
                    {ktitle}（{list.filter((r) => r.status === "open").length}件対応待ち / 全{list.length}件）
                  </div>
                  {list.map((r) => (
              <div key={r.id} className="border-b border-[#f0ece0] py-2.5 last:border-b-0" style={{ opacity: r.status === "open" ? 1 : 0.45 }}>
                <div className="flex items-center gap-2 text-[11px] text-[#a09888]">
                  <span className="rounded bg-[#f0ece0] px-1.5 py-0.5 font-bold text-[#6a5a3a]">
                    {r.kind === "cotozute" ? "Cotozute" : r.kind === "za" ? "楽市楽座" : "セカイムラ投稿"}
                  </span>
                  <span className="num">{new Date(r.created_at).toLocaleDateString("ja-JP")}</span>
                  {(() => {
                    const rp2 = r.reporterProf;
                    const inner = (
                      <span className="inline-flex items-center gap-1.5">
                        <span>依頼:</span>
                        {rp2?.avatar_url ? (
                          <img src={rp2.avatar_url} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5dcc8] text-[9px] text-[#8a8070]">?</span>
                        )}
                        <span className="font-bold text-[#3070b0] underline">{rp2?.display_name ?? "会員"}</span>
                      </span>
                    );
                    return rp2?.username ? (
                      <Link href={`/u/${rp2.username}`} className="no-underline">{inner}</Link>
                    ) : inner;
                  })()}
                  {r.status !== "open" && <span className="font-bold text-[#2a7a4a]">対応済み</span>}
                </div>
                {r.reason && <div className="mt-1 text-[12.5px] font-bold text-[#c94d3a]">理由: {r.reason}</div>}
                {r.excerpt && <div className="mt-0.5 line-clamp-2 text-[12px] text-[#5a5448]">「{r.excerpt}」</div>}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {r.target_url && (
                    <Link href={r.target_url} className="rounded-lg border border-[#e5dcc8] px-2.5 py-1 text-[11px] font-bold text-[#3070b0] no-underline">
                      投稿を見る →
                    </Link>
                  )}
                  {r.status === "open" && (
                    <button
                      onClick={async () => {
                        if (!confirm("通報された投稿そのものを削除します。よろしいですか？")) return;
                        const supabase = createClient();
                        const table = r.kind === "cotozute" ? "posts" : r.kind === "za" ? "shops" : "village_posts";
                        const { error } = await supabase.from(table).delete().eq("id", r.target_id);
                        if (error) { alert("削除できませんでした: " + error.message); return; }
                        await supabase.from("post_reports").update({ status: "done" }).eq("id", r.id);
                        if (me) load(me.id);
                      }}
                      className="rounded-lg bg-[#c05030] px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      投稿を削除する
                    </button>
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
                  ))}
                </div>
              );
            })
          )}
        </section>

        <p className="pb-2 text-center text-[10.5px] text-[#a09888]">
          事務局メンバー: マスター・西田あかね・マチルダ（アカウント登録時に自動で権限が付きます）
        </p>
      </div>
    </main>
  );
}
