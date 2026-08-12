"use client";

import { srcCdn } from "@/lib/images";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { MessageRow, fetchMessages, fetchMessagesSince, sendMessage, markRead } from "@/lib/line";
import type { CotozuteProfile } from "@/lib/cotozute";
import { TalkCall, peekCall } from "@/components/TalkCall";
import { parseFriendRequestId, fetchRequest, respondFriendRequest } from "@/lib/friends";

/** LINE — トーク画面（吹き出し・既読つけ・5秒ポーリング） */
export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;
  const [me, setMe] = useState<User | null>(null);
  const [partner, setPartner] = useState<(CotozuteProfile & { id: string }) | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callActive, setCallActive] = useState(0); // 相手が通話ルームにいる人数
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null); // 入力欄(自動で膨らむ)
  const draftKey = "talk-draft:" + String(chatId);
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setBody(d);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (body) localStorage.setItem(draftKey, body);
      else localStorage.removeItem(draftKey);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  const [photoPick, setPhotoPick] = useState(false); // 📷の2択シート
  const [photoSending, setPhotoSending] = useState(false);
  const camInput = useRef<HTMLInputElement | null>(null);
  const albInput = useRef<HTMLInputElement | null>(null);
  /** 写真を強圧縮(長辺1280px/WebP)してR2へ→メッセージ送信。表示はR2直なのでうちの転送料ゼロ */
  const sendPhoto = async (f: File) => {
    if (!me || photoSending) return;
    setPhotoSending(true);
    try {
      const { compressImage } = await import("@/lib/images");
      const blob = await compressImage(f, 1280, 0.55);
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("folder", "talk");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error ?? "upload");
      await sendMessage(chatId, me.id, "📷 写真", d.url);
      await load();
    } catch {
      alert("写真を送れませんでした。通信環境を確認してもう一度どうぞ");
    }
    setPhotoSending(false);
  };

  const [kb, setKb] = useState(0); // ソフトキーボードの高さ(入力欄をその真上に貼り付ける)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, []);
  const meRef = useRef<User | null>(null);

  /* 通話中かどうかを覗く（7秒ごと・自分が通話中は不要） */
  useEffect(() => {
    if (inCall) return;
    let stop = false;
    const check = () => peekCall(chatId).then((n) => !stop && setCallActive(n));
    check();
    const t = setInterval(check, 7000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [chatId, inCall]);

  const startCall = async () => {
    if (!me) return;
    setInCall(true);
    // まだ誰もいなければ「発信」— 相手にはどのページに居ても着信ポップアップが垂れてくる
    if (callActive === 0) {
      await sendMessage(chatId, me.id, "📞 電話をかけました — TALKを開いて、上の「参加する」からどうぞ");
      try {
        if (partner?.id) {
          const supabase = createClient();
          await supabase.from("call_rings").insert({ chat_id: chatId, caller_id: me.id, callee_id: partner.id });
        }
      } catch {}
    }
  };

  // 着信ポップアップの「応答」から来たら、すぐ通話に入る
  useEffect(() => {
    if (!me) return;
    try {
      if (new URLSearchParams(window.location.search).get("call") === "1") setInCall(true);
    } catch {}
  }, [me]);

  const cursorRef = useRef<string | null>(null);
  const tickRef = useRef(0);

  // 初回・6回に1回は全件（既読の反映用）、それ以外は新着だけ増分取得
  const load = useCallback(async () => {
    const full = cursorRef.current === null || tickRef.current % 6 === 0;
    tickRef.current++;
    if (full) {
      const list = await fetchMessages(chatId);
      setMessages(list);
      if (list.length) cursorRef.current = list[list.length - 1].created_at;
    } else {
      const fresh = await fetchMessagesSince(chatId, cursorRef.current!);
      if (fresh.length) {
        cursorRef.current = fresh[fresh.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
      }
    }
    if (meRef.current) markRead(chatId, meRef.current.id);
  }, [chatId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (!u) return;
      // 相手を特定
      const { data: chat } = await supabase
        .from("chats")
        .select(
          "a, b, pa:profiles!chats_a_fkey(username, display_name, avatar_url), pb:profiles!chats_b_fkey(username, display_name, avatar_url)"
        )
        .eq("id", chatId)
        .maybeSingle();
      if (chat) {
        const partnerIsA = chat.b === u.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (partnerIsA ? chat.pa : chat.pb) as any;
        setPartner({ ...(p ?? { username: null, display_name: "むらびと", avatar_url: null }), id: partnerIsA ? chat.a : chat.b });
      }
      load();
    });
  }, [chatId, load]);

  // 5秒ポーリング
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // 最下部（最後のメッセージ）へ。初回は瞬間移動 = 開いた瞬間から最新が見える（LINEの秘伝のタレ）
  const didInitScroll = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: didInitScroll.current ? "smooth" : "auto", block: "end" });
    didInitScroll.current = true;
  }, [messages.length]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    if (taRef.current) taRef.current.style.height = "auto";
    await sendMessage(chatId, me.id, text);
    setSending(false);
    load();
  };

  return (
    <main className="flex min-h-screen flex-col pb-32">
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/talk" className="text-[15px] font-bold text-[#d4b96a] no-underline">
          ◀
        </Link>
        {partner &&
          (partner.username ? (
            <Link href={`/u/${partner.username}`} className="flex items-center gap-2.5 no-underline">
              {partner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={srcCdn(partner.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="text-xl"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
              )}
              <span className="text-[15px] font-bold text-[#f0e6c8]">
                {partner.display_name ?? "むらびと"}
              </span>
            </Link>
          ) : (
            <span className="text-[15px] font-bold text-[#f0e6c8]">むらびと</span>
          ))}
        {me && (
          <button
            onClick={startCall}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "#2ab84a", boxShadow: "0 1px 6px rgba(42,184,74,.5)" }}
            aria-label="電話"
          >
            {/* 緑丸+白い受話器(LINEの通話ボタンと同じ視認性。絵文字は端末により黒くて見えない) */}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.85 21 3 13.15 3 3.5a1 1 0 0 1 1-1H7.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        )}
      </header>

      {/* 相手が通話中なら参加バナー */}
      {!inCall && callActive > 0 && (
        <button
          onClick={startCall}
          className="flex items-center justify-center gap-2 py-2.5 text-[13px] font-extrabold text-white"
          style={{ background: "linear-gradient(120deg,#2a9a5a,#1e7a46)" }}
        >
          📞 通話中です — タップして参加する
        </button>
      )}

      {/* 通話オーバーレイ */}
      {inCall && me && (
        <TalkCall
          chatId={chatId}
          me={me}
          partnerName={partner?.display_name ?? "むらびと"}
          onClose={() => setInCall(false)}
        />
      )}

      {/* メッセージ */}
      <div className="flex-1 space-y-2 bg-[#ece5d8] px-3 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === me?.id;
          const d = new Date(m.created_at);
          const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          const frId = parseFriendRequestId(m.body);
          if (frId && me) {
            return (
              <FriendRequestCard
                key={m.id}
                reqId={frId}
                mine={mine}
                meId={me.id}
                chatId={String(chatId)}
                partnerName={partner?.display_name ?? "相手"}
                onReplied={() => fetchMessages(String(chatId)).then(setMessages)}
              />
            );
          }
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {mine && (
                <span className="text-[9px] leading-tight text-[#a89e8c]">
                  {m.read_at ? "既読" : ""}
                  <br />
                  {time}
                </span>
              )}
              <div
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                  mine ? "rounded-br-md bg-[#8de055] text-[#1a2a10]" : "rounded-bl-md bg-white text-[#3a3428]"
                }`}
              >
                {m.image_url && (
                  <a href={m.image_url} target="_blank" rel="noopener">
                    <img src={m.image_url} alt="" loading="lazy" className="mb-1 max-h-[280px] w-full rounded-xl object-contain" style={{ maxWidth: 220 }} />
                  </a>
                )}
                {(() => {
                  if (m.image_url && String(m.body ?? "") === "📷 写真") return null;
                  const parts = String(m.body ?? "").split(/(https?:\/\/[^\s]+)/g);
                  return parts.map((pt, i) =>
                    /^https?:\/\//.test(pt) ? (
                      <a
                        key={i}
                        href={pt.startsWith("https://onesea.vercel.app") ? pt.replace("https://onesea.vercel.app", "") : pt}
                        target={pt.startsWith("https://onesea.vercel.app") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="break-all font-extrabold underline"
                        style={{ color: "#0a6ab0" }}
                      >
                        {pt}
                      </a>
                    ) : (
                      <span key={i}>{pt}</span>
                    )
                  );
                })()}
              </div>
              {!mine && <span className="text-[9px] text-[#a89e8c]">{time}</span>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="fixed inset-x-0 z-40 flex items-end gap-2 border-t border-[#e5dccb] bg-[#fffdf8] px-3 py-2" style={{ bottom: kb > 0 ? kb : 56 }}>
        {/* 📷 写真(LINE式・R2直行でうちの転送料ゼロ) */}
        <button
          onClick={() => setPhotoPick(true)}
          disabled={photoSending}
          aria-label="写真を送る"
          className="flex h-10 w-8 flex-shrink-0 items-center justify-center text-[20px] disabled:opacity-40"
        >
          {photoSending ? "⏳" : "📷"}
        </button>
        <input
          ref={camInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendPhoto(f);
          }}
        />
        <input
          ref={albInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendPhoto(f);
          }}
        />
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 112) + "px"; // 行が増えたら入力欄も膨らむ(上限4行ほど)
          }}
          placeholder="メッセージ..."
          rows={1}
          className="hide-scrollbar max-h-28 min-h-[38px] flex-1 resize-none rounded-2xl border border-[#e8dcc4] bg-white px-3.5 py-2 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
        />
        <button
          onClick={submit}
          disabled={!body.trim() || sending}
          aria-label="送信"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
          style={{ background: "#c94d3a" }}
        >
          ➤
        </button>
      </div>
      {/* 写真の出どころ2択 */}
      {photoPick && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45" onClick={() => setPhotoPick(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#ddd]" />
            <button
              onClick={() => {
                setPhotoPick(false);
                camInput.current?.click();
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border-2 border-[#c8dccb] bg-[#f4faf5] px-4 py-3.5 text-left text-[14px] font-extrabold text-[#2a5a3a]"
            >
              📷 カメラで撮る
            </button>
            <button
              onClick={() => {
                setPhotoPick(false);
                albInput.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-[#c8d4e8] bg-[#f4f8ff] px-4 py-3.5 text-left text-[14px] font-extrabold text-[#2a4a7a]"
            >
              🖼 アルバムから選ぶ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** ともだち申請カード（TALK内）。受け取った側に「ともだちになる / 今はならない」の2ボタン。
 *  下のメッセージ欄は定型文入り（自由に書き換えOK）。押すと応答＋返信が送られる */
function FriendRequestCard({
  reqId, mine, meId, chatId, partnerName, onReplied,
}: {
  reqId: string; mine: boolean; meId: string; chatId: string; partnerName: string; onReplied: () => void;
}) {
  const [req, setReq] = useState<{ status: string; to_user: string } | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const OK_DEFAULT = "ありがとうございます。ともだちになりましょう。";
  const NG_DEFAULT = "今は、ともだちの上限数なのでまたあとで申請してね";

  useEffect(() => {
    fetchRequest(reqId).then((r) => setReq(r ?? null));
  }, [reqId]);

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    const ok = await respondFriendRequest(reqId, accept);
    if (ok) {
      const text = msg.trim() || (accept ? OK_DEFAULT : NG_DEFAULT);
      await sendMessage(chatId, meId, text);
      setReq((r) => (r ? { ...r, status: accept ? "accepted" : "declined" } : r));
      onReplied();
    }
    setBusy(false);
  };

  const canRespond = req && req.status === "pending" && req.to_user === meId;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="w-[86%] max-w-[320px] rounded-2xl border border-[#d4c8a8] bg-[#fdf9ee] p-3.5 shadow-sm">
        <div className="text-[13px] font-extrabold text-[#8a6a20]">
          🤝 {mine ? "ともだちの申請を送りました" : "ともだちの申請が届いています"}
        </div>
        {req === undefined ? (
          <p className="mt-1 text-[11px] text-[#b0a890]">読み込み中...</p>
        ) : req === null ? (
          <p className="mt-1 text-[11px] text-[#b0a890]">この申請は見つかりませんでした</p>
        ) : req.status === "accepted" ? (
          <p className="mt-1 text-[12px] font-bold text-[#2a8a4a]">✅ ともだちになりました</p>
        ) : req.status === "declined" ? (
          <p className="mt-1 text-[12px] text-[#a09888]">今回は見送りになりました（また申請できます）</p>
        ) : canRespond ? (
          <div className="mt-2">
            <div className="flex gap-2">
              <button
                onClick={() => respond(true)}
                disabled={busy}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#2a8a4a" }}
              >
                ともだちになる
              </button>
              <button
                onClick={() => respond(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-[#d0c8b0] bg-white py-2.5 text-[13px] font-bold text-[#8a8070] disabled:opacity-40"
              >
                今はならない
              </button>
            </div>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
              placeholder={`返信メッセージ（空のままなら定型文が送られます）\n「${OK_DEFAULT}」/「${NG_DEFAULT}」`}
              className="mt-2 w-full rounded-xl border border-[#e0d8c4] bg-white p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-[#c9a94a]"
            />
          </div>
        ) : (
          <p className="mt-1 text-[11.5px] text-[#a09888]">{partnerName}さんの返事を待っています…</p>
        )}
      </div>
    </div>
  );
}
