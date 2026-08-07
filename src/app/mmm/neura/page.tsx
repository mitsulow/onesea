"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import { NEURA_SIZE, NeuraTeam, fetchMyDdp, myNeuraTeam } from "@/lib/mmm";
import {
  fetchGroupMessages,
  sendGroupMessage,
  markGroupRead,
  GroupMessageRow,
} from "@/lib/line";
import { srcCdn } from "@/lib/images";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/**
 * 🧠 ニューラFIVE — わらわ〜会員が入った順に5人1チーム（事務局自動編成）。
 * 仲間 / ニューラガイド（二十四節気ミッション） / チャット（TalKグループと同期）の3タブ。
 * ゴールは11月末（小雪）— 5人でDDPを叶える。
 */

/** 二十四節気ミッション（2026年・立秋スタート→小雪で叶う） */
const MISSIONS: Array<{
  sekki: string;
  yomi: string;
  from: string; // YYYY-MM-DD
  to: string;
  theme: string;
  body: string[];
}> = [
  {
    sekki: "立秋", yomi: "りっしゅう", from: "2026-08-07", to: "2026-08-22",
    theme: "Zoomで5人で会ってみよう",
    body: [
      "ニューラFIVEの始まりです。まずはチャットで自己紹介をして、5人全員がオンラインで繋がる日にちを決めてください。",
      "●チャットでやること",
      "・自己紹介（住んでいる町、好きなこと）",
      "・5人でZoomする日程を決める",
      "●Zoomでやること",
      "・お互いの共通点探し",
      "・最近楽しかったこと、嬉しかったことの共有",
      "顔を見て声を聞くだけで、チームは一気に「仲間」になります。",
    ],
  },
  {
    sekki: "処暑", yomi: "しょしょ", from: "2026-08-23", to: "2026-09-06",
    theme: "リアルで5人で会ってみよう",
    body: [
      "オンラインの次は、実際に同じ時間と空間を共有してみましょう。",
      "●この期間にやること",
      "・5人（難しければ集まれる人数）でリアルに会う日と場所を決める",
      "・お茶でも散歩でも、集まること自体がミッション達成",
      "実際に会うと、オンラインでは感じられない気づきやつながりが生まれます。遠方で難しいチームは、もう一度Zoomでゆっくり話す時間でもOKです。",
    ],
  },
  {
    sekki: "白露", yomi: "はくろ", from: "2026-09-07", to: "2026-09-22",
    theme: "お互いの夢DDPを知り合おう",
    body: [
      "いよいよDDPの共有です。一人ひとりが描いている夢を、5人全員が知っている状態にしましょう。",
      "●本人の役目",
      "・自分のDDPをできるだけ詳細に描くこと",
      "・「私のDDPはこれ」と、しっかり仲間に伝えること",
      "●聞く4人の役目",
      "・質問して、その人のDDPをもっと具体的にしてあげること",
      "伝わった夢だけが、仲間の力で動き出します。まだDDPを設定していない人は、この期間中に必ず設定を。",
    ],
  },
  {
    sekki: "秋分", yomi: "しゅうぶん", from: "2026-09-23", to: "2026-10-07",
    theme: "メンバーのDDPを叶える情報を集めよう",
    body: [
      "ここからがニューラFIVEの本番。自分以外の4人のDDPが叶うために動きます。",
      "●4人の役目",
      "・メンバーのDDPが叶うための情報を集めてチャットで届ける",
      "・役に立ちそうな人、場所、本、イベント…何でもOK",
      "●本人の役目",
      "・届いた情報に必ず反応すること（受け取りが循環を生む）",
      "自分の夢は、自分一人で叶えようとすると「自分」に意識が向きがちです。仲間の夢のために動くとき、思いもよらない可能性とご縁が生まれます。",
    ],
  },
  {
    sekki: "寒露", yomi: "かんろ", from: "2026-10-08", to: "2026-10-22",
    theme: "ビジョンマップを作ってプレゼントしよう",
    body: [
      "集めた情報をカタチにして、仲間に贈る期間です。",
      "●この期間にやること",
      "・担当を決めて（または全員で）、メンバーのDDPが叶った世界のビジョンマップを作る",
      "・写真の切り抜き、手描き、スマホのコラージュ…形式は自由",
      "・完成したらチャットやZoomでプレゼントする",
      "「あなたの夢は、もう叶った世界がある」——それを目に見える形で贈られたとき、DDPは一気に現実へ近づきます。",
    ],
  },
  {
    sekki: "霜降", yomi: "そうこう", from: "2026-10-23", to: "2026-11-06",
    theme: "メンバーのDDPが叶う証拠を伝えよう",
    body: [
      "叶う「証拠」を見つけて伝え合う期間です。",
      "●4人の役目",
      "・メンバーのDDPが叶いつつある証拠（小さな変化・偶然・シンクロ）を見つけたら、すぐチャットで伝える",
      "・「それ、もう叶い始めてるよ」と言葉にしてあげる",
      "●本人の役目",
      "・自分に起きた小さな変化も、隠さずチームに共有する",
      "証拠を数えはじめた夢は、加速します。",
    ],
  },
  {
    sekki: "立冬", yomi: "りっとう", from: "2026-11-07", to: "2026-11-21",
    theme: "叶った瞬間を5人で迎える準備をしよう",
    body: [
      "ゴールの小雪はもう目前。総仕上げの期間です。",
      "●この期間にやること",
      "・これまでに集めた情報・ビジョンマップ・証拠をチャットで振り返る",
      "・「あと一歩」が何かを5人で話し合い、最後の後押しをする",
      "・小雪に5人で集まる日（Zoomでもリアルでも）を決めておく",
    ],
  },
  {
    sekki: "小雪", yomi: "しょうせつ", from: "2026-11-22", to: "2026-12-06",
    theme: "DDPが叶う——5人で祝おう",
    body: [
      "ニューラFIVEのゴールです。",
      "●この期間にやること",
      "・5人で集まり、それぞれのDDPに起きたことを発表し合う",
      "・叶ったことは全力で祝う。叶いつつあることは、その証拠を全員で確認する",
      "・お互いへの感謝を伝え合う",
      "夢は、一人で叶えるものではなく、仲間と叶え合うもの。この3ヶ月半の体験そのものが、あなたのDDPに新たな広がりをもたらしてくれるはずです。",
    ],
  },
];

const dtf = (s: string) => {
  const d = new Date(s + "T00:00:00+09:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function NeuraPage() {
  const [me, setMe] = useState<User | null>(null);
  const [isWara, setIsWara] = useState<boolean | null>(null);
  const [myDdp, setMyDdp] = useState("");
  const [team, setTeam] = useState<NeuraTeam | null | undefined>(undefined);
  const [tab, setTab] = useState<"members" | "guide" | "chat">("members");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) { setTeam(null); setIsWara(false); return; }
      const { data: prof } = await supabase.from("profiles").select("warawa_until").eq("id", u.id).maybeSingle();
      const wara = !!prof?.warawa_until && new Date(prof.warawa_until as string) > new Date();
      setIsWara(wara);
      setMyDdp(await fetchMyDdp(u.id));
      let t = await myNeuraTeam(u.id);
      if (!t && wara) {
        // 事務局自動編成（お試し版: わらわ〜会員が入った順に5人1チーム）
        const { data: tid } = await supabase.rpc("neura_autojoin");
        if (tid) t = await myNeuraTeam(u.id);
      }
      setTeam(t);
    });
  }, []);

  const today = new Date();
  const curIdx = MISSIONS.findIndex(
    (ms) => today >= new Date(ms.from + "T00:00:00+09:00") && today < new Date(new Date(ms.to + "T00:00:00+09:00").getTime() + 86400000)
  );

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

      {/* 概要 */}
      <p className="px-5 pt-2 text-[12px] leading-relaxed text-[#8a9ab8]">
        近くの5人でチームを組み（事務局が自動編成）、<b className="text-[#c8d4f8]">11月末までにお互いのDDPを叶え合う</b>活動。
        あなたの役目は自分のDDPを詳細に描いて伝えること。あなたの夢は、残りの4人が叶えてくれる。
      </p>

      {team === undefined ? (
        <p className="px-5 py-4 text-[12px] text-[#5a6a8a]">読み込み中...</p>
      ) : !me ? (
        <p className="px-5 py-4 text-[12px] text-[#5a6a8a]">ログインすると参加できます</p>
      ) : !isWara && !team ? (
        <div className="mx-4 mt-3 rounded-2xl border border-[#2a3a55] bg-white/5 p-4 text-center">
          <p className="text-[12.5px] leading-relaxed text-[#8a9ab8]">
            ニューラFIVEは<b className="text-[#c8d4f8]">わらわ〜会員</b>の活動です。
            <br />登録すると、入った順に5人チームが自動で組まれます。
          </p>
          <Link href="/lp/mmm" className="mt-2.5 inline-block rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-[#101a28] no-underline" style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}>
            わらわ〜会員について →
          </Link>
        </div>
      ) : !team ? (
        <p className="px-5 py-4 text-[12px] text-[#5a6a8a]">チームを編成しています。少し待ってからもう一度開いてください</p>
      ) : (
        <>
          {/* タブ */}
          <div className="sticky top-0 z-40 mt-2 flex border-b border-[#1e2a45]" style={{ background: "#0d1520" }}>
            {(
              [
                ["members", "仲間"],
                ["guide", "ニューラガイド"],
                ["chat", "チャット"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="flex-1 py-2.5 text-[12.5px] font-extrabold"
                style={
                  tab === k
                    ? { color: "#c8d4f8", borderBottom: "2.5px solid #8a9af0" }
                    : { color: "#4a5a78", borderBottom: "2.5px solid transparent" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── 仲間タブ ── */}
          {tab === "members" && (
            <div className="px-4 pt-3">
              {/* 5人のアイコンならび */}
              <div className="mb-3 flex items-center justify-center gap-3">
                {team.members.map((m) => (
                  <span key={m.user_id} className="flex flex-col items-center gap-1">
                    {m.profiles?.avatar_url ? (
                      <img src={srcCdn(m.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full border-2 border-[#8a9af0]/40 object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#8a9af0]/40 bg-[#2a3a55]">
                        <img src="/icons/icon-neura5.webp" alt="" style={{ width: 24, height: 24 }} />
                      </span>
                    )}
                    <span className="max-w-[56px] truncate text-[9px] text-[#8a9ab8]">
                      {m.user_id === me?.id ? "あなた" : (m.profiles?.display_name ?? "仲間")}
                    </span>
                  </span>
                ))}
                {Array.from({ length: Math.max(0, NEURA_SIZE - team.members.length) }).map((_, i) => (
                  <span key={i} className="flex flex-col items-center gap-1">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-[#2a3a55] text-[15px] text-[#4a5a78]">＋</span>
                    <span className="text-[9px] text-[#4a5a78]">募集中</span>
                  </span>
                ))}
              </div>

              {/* 役目の説明 */}
              <div className="mb-3 rounded-2xl border border-[#2a3a55] bg-white/5 p-3.5">
                <div className="mb-1.5 text-[11.5px] font-extrabold tracking-[1.5px] text-[#c8d4f8]">■ ニューラFIVEの役目</div>
                <p className="text-[12px] leading-relaxed text-[#8a9ab8]">
                  <b className="text-[#c8d4f8]">本人の役目</b> — 自分のDDPを詳細に描き、しっかり仲間に伝えること。
                  <br />
                  <b className="text-[#c8d4f8]">残り4人の役目</b> — その人のDDPが叶うために、情報を集めたり、ビジョンマップを作ってプレゼントしたり、叶う証拠を伝えてあげること。
                </p>
              </div>

              {!myDdp && (
                <Link href="/mmm/ddp" className="mb-3 block rounded-xl border border-[#2a4a3a] bg-[#0c1812] px-3 py-2.5 text-center text-[12.5px] font-bold text-[#7de0a0] no-underline">
                  <img src="/icons/icon-ddp.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> まずは自分のDDPを設定する →
                </Link>
              )}

              {/* メンバーごとのDDP */}
              <div className="space-y-1.5">
                {team.members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
                    {m.profiles?.avatar_url ? (
                      <img src={srcCdn(m.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
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
              </div>
            </div>
          )}

          {/* ── ニューラガイドタブ（二十四節気ミッション） ── */}
          {tab === "guide" && (
            <div className="px-4 pt-3">
              <div className="relative ml-2 border-l-2 border-[#2a3a55] pl-4">
                {MISSIONS.map((ms, i) => (
                  <MissionCard key={ms.sekki} ms={ms} state={i === curIdx ? "now" : i < (curIdx === -1 ? (today < new Date(MISSIONS[0].from) ? 0 : MISSIONS.length) : curIdx) ? "past" : "future"} />
                ))}
              </div>
              <p className="py-3 text-center text-[10.5px] text-[#4a5a78]">
                二十四節気ごとに新しいミッションが届きます ・ 叶うのは11月末（小雪）
              </p>
            </div>
          )}

          {/* ── チャットタブ（TalKグループと同期） ── */}
          {tab === "chat" && me && <NeuraChat teamId={team.id} me={me} />}
        </>
      )}
    </main>
  );
}

/** ガイドのミッションカード — 今ここは開いた状態、過去/未来は折りたたみ */
function MissionCard({ ms, state }: { ms: (typeof MISSIONS)[number]; state: "now" | "past" | "future" }) {
  const [open, setOpen] = useState(state === "now");
  const dim = state !== "now";
  return (
    <div className="relative mb-4">
      <span
        className="absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full"
        style={{ background: state === "now" ? "#8a9af0" : "#2a3a55", boxShadow: state === "now" ? "0 0 10px rgba(138,154,240,.8)" : "none" }}
      />
      <button onClick={() => setOpen(!open)} className="block w-full text-left">
        <div className="flex items-center gap-2">
          {state === "now" && (
            <span className="rounded-full bg-[#8a9af0] px-2 py-0.5 text-[9.5px] font-extrabold text-[#101a28]">今ここ</span>
          )}
          <span className="text-[15px] font-extrabold tracking-[2px]" style={{ color: dim ? "#4a5a78" : "#c8d4f8" }}>{ms.sekki}</span>
          <span className="num text-[10.5px]" style={{ color: dim ? "#3a4a68" : "#8a9ab8" }}>{dtf(ms.from)} 〜 {dtf(ms.to)}</span>
          <span className="ml-auto text-[10px]" style={{ color: "#4a5a78" }}>{open ? "▲" : "▼"}</span>
        </div>
        <div className="mt-0.5 text-[12.5px] font-bold" style={{ color: dim ? "#4a5a78" : "#a8e0c0" }}>【{ms.theme}】</div>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-[#2a3a55] bg-white/5 p-3.5">
          <div className="mb-1.5 text-[12px] font-extrabold text-[#c8d4f8]">
            {ms.sekki}（{ms.yomi}） {dtf(ms.from)} 〜 {dtf(ms.to)} のガイド
          </div>
          {ms.body.map((line, i) => (
            <p
              key={i}
              className="mb-1.5 text-[12.5px] leading-relaxed"
              style={{ color: line.startsWith("●") ? "#a8e0c0" : line.startsWith("・") ? "#8a9ab8" : "#b8c4d8", fontWeight: line.startsWith("●") ? 700 : 400 }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** 5人のグループチャット — group_messages(scope=neura)なのでTalKのグループと完全同期 */
function NeuraChat({ teamId, me }: { teamId: string; me: User }) {
  const [msgs, setMsgs] = useState<GroupMessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const list = await fetchGroupMessages("neura", teamId);
    setMsgs(list);
    markGroupRead("neura", teamId, me.id);
  }, [teamId, me.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await sendGroupMessage("neura", teamId, me.id, text.trim());
    setText("");
    await load();
    setSending(false);
  };

  return (
    <div className="flex flex-col px-3 pt-2" style={{ minHeight: "50dvh" }}>
      <p className="pb-1.5 text-center text-[9.5px] text-[#4a5a78]">
        TalKの「グループTalK」と同じ内容が届きます（どちらで書いてもOK）
      </p>
      <div className="flex-1 space-y-2 overflow-y-auto pb-2" data-noswipe>
        {msgs.length === 0 && <p className="py-6 text-center text-[12px] text-[#4a5a78]">まだメッセージがありません。最初のひとことをどうぞ</p>}
        {msgs.map((mm: any) => {
          const mine = mm.sender_id === me.id;
          return (
            <div key={mm.id} className={"flex items-end gap-1.5 " + (mine ? "justify-end" : "")}>
              {!mine && (
                mm.profiles?.avatar_url ? (
                  <img src={srcCdn(mm.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#2a3a55] text-[10px] text-[#8a9ab8]">?</span>
                )
              )}
              <div className={"max-w-[75%]"}>
                {!mine && <div className="mb-0.5 pl-1 text-[9px] text-[#5a6a8a]">{mm.profiles?.display_name ?? "仲間"}</div>}
                <div
                  className="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
                  style={mine ? { background: "#8a9af0", color: "#101a28" } : { background: "rgba(255,255,255,.08)", color: "#e8ecff" }}
                >
                  {mm.body}
                </div>
                <div className={"num mt-0.5 text-[8.5px] text-[#4a5a78] " + (mine ? "text-right" : "pl-1")}>
                  {new Date(mm.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="sticky bottom-[64px] flex items-end gap-2 border-t border-[#1e2a45] pb-1 pt-2" style={{ background: "#0d1520" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="メッセージを書く…"
          className="min-w-0 flex-1 resize-none rounded-2xl border border-[#2a3a55] bg-white/5 px-3 py-2 text-[13.5px] text-[#e8ecff] outline-none focus:border-[#8a9af0]"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold text-[#101a28] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}
        >
          送信
        </button>
      </div>
    </div>
  );
}
