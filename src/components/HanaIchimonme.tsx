"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { getOrCreateChat, sendMessage } from "@/lib/line";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/**
 * 🚩 この指とまれ 花いちもんめ — クエストカード×スキルカードのプロジェクト結成遊び。
 * ① 旗を立てる(やりたいこと+欲しいスキル) → 該当スキルの人へ🔔が飛ぶ
 * ② みんなが自分のスキルカードで「この指とまる」
 * ③ 旗主が集まったカードをめくって「この人が欲しい♪」→ 承諾で加入
 * ④ 3人そろったら花いちもんめ結成 — 専用TALKで始動
 */

const CARD_COLORS = [
  ["#fdf6ec", "#c94d3a"],
  ["#ecf4f0", "#1e6a50"],
  ["#eef6e8", "#3a5a2c"],
  ["#fdf0ee", "#a04030"],
  ["#f0f4fa", "#2a4a7a"],
  ["#fffbe8", "#8a6a10"],
  ["#f4eefa", "#5a3a7a"],
] as const;

export function HanaIchimonme({ me }: { me: User | null }) {
  const [quests, setQuests] = useState<any[] | null>(null);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [mySkills, setMySkills] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [needs, setNeeds] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: qs } = await supabase
      .from("quests")
      .select("*, profiles!quests_owner_fkey(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(40);
    setQuests(qs ?? []);
    const ids = (qs ?? []).map((q) => q.id);
    if (ids.length) {
      const { data: ms } = await supabase
        .from("quest_members")
        .select("*, profiles!quest_members_user_id_fkey(username, display_name, avatar_url)")
        .in("quest_id", ids)
        .order("created_at", { ascending: true });
      const by: Record<string, any[]> = {};
      (ms ?? []).forEach((m) => {
        (by[m.quest_id] = by[m.quest_id] || []).push(m);
      });
      setMembers(by);
    }
    if (me) {
      const { data: prof } = await supabase.from("profiles").select("skills").eq("id", me.id).maybeSingle();
      setMySkills((prof?.skills as string[]) ?? []);
    }
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const flag = async () => {
    if (!me || !title.trim() || saving) return;
    setSaving(true);
    const supabase = createClient();
    const need = needs.split(/[、,]/).map((x) => x.trim()).filter(Boolean).slice(0, 10);
    await supabase.from("quests").insert({ owner: me.id, title: title.trim(), description: desc.trim() || null, need_skills: need });
    setSaving(false);
    setFlagging(false);
    setTitle("");
    setDesc("");
    setNeeds("");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl px-3.5 py-3 text-center" style={{ background: "linear-gradient(150deg,#3a1a10,#6a3018)" }}>
        <div className="text-[16px] font-extrabold tracking-[2px] text-[#ffd9a0]">🚩 この指とまれ 花いちもんめ</div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#e8c8a8]">
          やりたいことの旗を立てると、そのスキルを持つ人にお知らせが飛ぶ。
          みんなが「この指とまる」— 旗主がスキルカードをめくって<b>「この人が欲しい♪」</b>。
          3人そろったら結成、専用TALKで始動。
        </p>
      </div>

      {/* 旗を立てる */}
      {me &&
        (flagging ? (
          <div className="rounded-2xl border-2 border-[#c94d3a66] bg-white p-3">
            <div className="mb-1.5 text-[12.5px] font-extrabold text-[#c94d3a]">🚩 旗を立てる</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="やりたいこと（例: デザイン事業を立ち上げたい）"
              className="w-full rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[#c94d3a]"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="くわしく（どんな仲間と、何をする？）"
              className="mt-1.5 w-full resize-none rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#c94d3a]"
            />
            <input
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              placeholder="欲しいスキル（例: 料理、デザイン、大工仕事、皿洗い、パソコン、運転、税理士、動画編集…）「、」区切りで何個でも"
              className="mt-1.5 w-full rounded-xl border border-[#ede5d8] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-1 text-[10px] text-[#b0a890]">※このスキルをプロフィールに書いている人へ🔔が飛びます</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setFlagging(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a09888]">キャンセル</button>
              <button
                onClick={flag}
                disabled={!title.trim() || saving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#c94d3a" }}
              >
                {saving ? "立てています..." : "🚩 この指とまれ！"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setFlagging(true)}
            className="w-full rounded-2xl border-2 border-dashed border-[#c94d3a88] bg-white py-3 text-[13.5px] font-extrabold text-[#c94d3a]"
          >
            🚩 旗を立てる（やりたいことに仲間を集める）
          </button>
        ))}

      {/* 旗一覧 */}
      {quests === null ? (
        <p className="py-3 text-center text-[12px] text-[#a09888]">読み込み中...</p>
      ) : quests.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-[#a09888]">まだ旗がありません。最初の旗を立てよう</p>
      ) : (
        quests.map((q) => (
          <QuestCard
            key={q.id}
            q={q}
            ms={members[q.id] ?? []}
            me={me}
            mySkills={mySkills}
            open={openId === q.id}
            onToggle={() => setOpenId(openId === q.id ? null : q.id)}
            onChanged={load}
          />
        ))
      )}
    </div>
  );
}

function QuestCard({
  q,
  ms,
  me,
  mySkills,
  open,
  onToggle,
  onChanged,
}: {
  q: any;
  ms: any[];
  me: User | null;
  mySkills: string[];
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const isOwner = me?.id === q.owner;
  const accepted = ms.filter((m) => m.status === "accepted");
  const waiting = ms.filter((m) => m.status === "tomaru");
  const myEntry = me ? ms.find((m) => m.user_id === me.id) : null;
  const formed = accepted.length >= 2; // 旗主+2人=3人で結成
  const [pickSkill, setPickSkill] = useState("");

  const tomaru = async (skill: string) => {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("quest_members").insert({ quest_id: q.id, user_id: me.id, skill });
    onChanged();
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: formed ? "#c8a860" : "#ede5d8" }}>
      <button onClick={onToggle} className="block w-full p-3 text-left">
        <div className="flex items-start gap-2.5">
          {q.profiles?.avatar_url ? (
            <img src={srcCdn(q.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#fdf0e4] text-[16px]">🚩</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14.5px] font-extrabold text-[#3a3428]">{q.title}</span>
              {formed && (
                <span className="flex-shrink-0 rotate-[-8deg] rounded-full border-2 border-[#d02020] px-1.5 text-[9px] font-extrabold text-[#d02020]">結成</span>
              )}
            </div>
            <div className="mt-0.5 text-[10.5px] text-[#a09888]">
              旗主 {q.profiles?.display_name ?? "—"} ・ とまってる {waiting.length}人 ・ 仲間 {accepted.length + 1}人
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(q.need_skills ?? []).map((sk: string) => (
                <span key={sk} className="rounded-full bg-[#fdf0e4] px-2 py-0.5 text-[9.5px] font-bold text-[#b0532e]">
                  募集: {sk}
                </span>
              ))}
            </div>
          </div>
          <span className="flex-shrink-0 text-[11px] text-[#c0b8a8]">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#f0ece0] px-3 pb-3 pt-2">
          {q.description && <p className="mb-2 text-[12.5px] leading-relaxed text-[#5a5448]">{q.description}</p>}

          {/* 結成メンバー */}
          {accepted.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[10px] font-bold text-[#8a6a42]">🌸 花いちもんめの仲間</div>
              <div className="flex flex-wrap gap-1.5">
                {accepted.map((m) => (
                  <span key={m.user_id} className="flex items-center gap-1 rounded-full bg-[#fdf6e8] px-2 py-1 text-[10.5px] font-bold text-[#8a6a42]">
                    {m.profiles?.avatar_url ? (
                      <img src={srcCdn(m.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full object-cover" />
                    ) : "🙂"}
                    {m.profiles?.display_name}（{m.skill}）
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 旗主: 集まったスキルカードをめくって指名 */}
          {isOwner && waiting.length > 0 && (
            <OwnerDeck
              waiting={waiting}
              onPick={async (m) => {
                const supabase = createClient();
                await supabase.from("quest_members").update({ status: "picked" }).eq("quest_id", q.id).eq("user_id", m.user_id);
                try {
                  const chatId = await getOrCreateChat(me!.id, m.user_id);
                  if (chatId) await sendMessage(chatId, me!.id, `【花いちもんめ】「${q.title}」で、あなたの「${m.skill}」が欲しい♪ 承諾は楽市楽座の「この指とまれ」からどうぞ`);
                } catch {}
                onChanged();
              }}
            />
          )}
          {isOwner && waiting.length === 0 && accepted.length === 0 && (
            <p className="py-1 text-[11.5px] text-[#a09888]">まだ誰もとまっていません。🔔は飛んでいるので待ちましょう</p>
          )}

          {/* 指名された本人: 承諾 */}
          {myEntry?.status === "picked" && (
            <button
              onClick={async () => {
                const supabase = createClient();
                await supabase.from("quest_members").update({ status: "accepted" }).eq("quest_id", q.id).eq("user_id", me!.id);
                onChanged();
              }}
              className="mb-2 w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white"
              style={{ background: "#c8a030" }}
            >
              🌸「勝って嬉しい花いちもんめ」— 指名を承諾して仲間になる
            </button>
          )}
          {myEntry?.status === "tomaru" && <p className="mb-2 text-[11.5px] font-bold text-[#b0532e]">☝ とまって旗主の指名を待っています（{myEntry.skill}）</p>}
          {myEntry?.status === "accepted" && <p className="mb-2 text-[11.5px] font-bold text-[#8a6a42]">🌸 あなたはこの花いちもんめの仲間です</p>}

          {/* とまる: 自分のスキルカードを差し出す */}
          {me && !isOwner && !myEntry && (
            <div>
              <div className="mb-1 text-[10px] font-bold text-[#8a7a5a]">☝ この指とまる — 差し出すスキルカードを選ぶ</div>
              {mySkills.length === 0 ? (
                <a href="/settings/profile" className="text-[11.5px] font-bold text-[#c94d3a] underline">
                  まずプロフィールにスキルを書く →
                </a>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {mySkills.map((sk, i) => {
                    const [bg, fg] = CARD_COLORS[i % CARD_COLORS.length];
                    const wanted = (q.need_skills ?? []).includes(sk);
                    return (
                      <button
                        key={sk}
                        onClick={() => setPickSkill(pickSkill === sk ? "" : sk)}
                        className="px-2.5 py-1.5 text-[11.5px] font-extrabold"
                        style={{
                          background: bg,
                          color: fg,
                          boxShadow: pickSkill === sk ? "0 0 0 2px #c94d3a" : "1px 2px 6px rgba(0,0,0,.15)",
                          outline: wanted ? "2px dashed #c8a030" : "none",
                        }}
                      >
                        {sk}{wanted ? " ★" : ""}
                      </button>
                    );
                  })}
                </div>
              )}
              {pickSkill && (
                <button
                  onClick={() => tomaru(pickSkill)}
                  className="mt-2 w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white"
                  style={{ background: "#b0532e" }}
                >
                  ☝「{pickSkill}」でこの指とまる！
                </button>
              )}
            </div>
          )}
          {!me && <p className="text-[11px] text-[#a09888]">ログインすると指にとまれます</p>}

          {/* 旗主: 取り下げ */}
          {isOwner && (
            <button
              onClick={async () => {
                if (!confirm("この旗を取り下げますか？")) return;
                const supabase = createClient();
                await supabase.from("quests").delete().eq("id", q.id);
                onChanged();
              }}
              className="mt-2 text-[10px] text-[#b0a890] underline"
            >
              旗を取り下げる
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 旗主用: 集まったスキルカードのデッキ — めくって「この人が欲しい♪」 */
function OwnerDeck({ waiting, onPick }: { waiting: any[]; onPick: (m: any) => void }) {
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState(false);
  const startX = useRef<number | null>(null);
  const n = waiting.length;
  const cur = waiting[idx % n];
  const [bg, fg] = CARD_COLORS[(idx % n) % CARD_COLORS.length];

  const next = () => {
    if (fly || n < 2) return;
    setFly(true);
    setDx(-window.innerWidth * 0.8);
    setTimeout(() => {
      setFly(false);
      setDx(0);
      setIdx((i) => (i + 1) % n);
    }, 150);
  };

  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-bold text-[#8a6a42]">🃏 とまっているスキルカード — めくって選ぶ</div>
      <div className="relative mx-auto select-none" style={{ height: 132, maxWidth: 280 }} data-noswipe>
        {[2, 1].map((k) =>
          k < n ? (
            <div
              key={k}
              className="absolute inset-x-0 mx-auto"
              style={{
                top: 4 + k * 5,
                height: 104,
                maxWidth: 280 - k * 12,
                background: CARD_COLORS[((idx + k) % n) % CARD_COLORS.length][0],
                border: "1px solid rgba(0,0,0,.08)",
                boxShadow: "0 2px 6px rgba(0,0,0,.12)",
              }}
            />
          ) : null
        )}
        <div
          key={idx % n}
          onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
          onTouchMove={(e) => { if (startX.current != null) setDx(e.touches[0].clientX - startX.current); }}
          onTouchEnd={() => { startX.current = null; if (Math.abs(dx) > 45) next(); else setDx(0); }}
          onClick={() => Math.abs(dx) < 5 && next()}
          className="absolute inset-x-0 top-1 mx-auto flex cursor-pointer items-center gap-2.5 px-3"
          style={{
            height: 108,
            maxWidth: 280,
            background: bg,
            boxShadow: "3px 5px 14px rgba(0,0,0,.22)",
            border: "1px solid rgba(0,0,0,.06)",
            transform: `translateX(${dx}px) rotate(${dx * 0.04}deg)`,
            transition: fly ? "transform .15s ease-in" : startX.current != null ? "none" : "transform .12s ease-out",
            touchAction: "pan-y",
          }}
        >
          {cur.profiles?.avatar_url ? (
            <img src={srcCdn(cur.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/60 text-[18px]">🙂</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-extrabold leading-tight" style={{ color: fg }}>{cur.skill}</div>
            <div className="truncate text-[11px]" style={{ color: fg, opacity: 0.75 }}>{cur.profiles?.display_name}</div>
          </div>
          <span className="num absolute bottom-1 right-2 text-[9px] opacity-60">{(idx % n) + 1}/{n}</span>
        </div>
      </div>
      <button
        onClick={() => onPick(cur)}
        className="mt-1.5 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white"
        style={{ background: "#c94d3a" }}
      >
        🌸 この人が欲しい♪（{cur.profiles?.display_name}の「{cur.skill}」を指名）
      </button>
    </div>
  );
}
