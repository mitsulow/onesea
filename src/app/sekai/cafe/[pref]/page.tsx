"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";

/* eslint-disable @next/next/no-img-element */

/**
 * 村人ラウンジ喫茶 〜いつでもオープン〜
 * ブラウザの WebRTC（P2Pメッシュ）+ Supabase Realtime（presence/broadcast）。サーバー費用ゼロ。
 * - 入る前に「文字だけ / 声だけ / カメラ」を選ぶ
 * - 3人以上でラウンジがオープン（それまでは「あと◯人」待機。接続は裏で済ませてあるので開店は一瞬）
 * - 1ラウンジ最大6人（2×3の画面配置が一番見やすい）。あふれたら No.2 が自動で開く
 * - 文字の人はカメラ映像の下のチャットで参加。声の人はカメラオフで声だけ
 */

const ICE = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

/** 1ラウンジの上限（2×3グリッドが一番見やすい）。超えたら No.2, No.3... が自動で開く */
const ROOM_CAP = 6;
/** この人数が揃うとラウンジがオープン */
const OPEN_AT = 3;

type Mode = "video" | "voice" | "text";

/** ルームの在室人数を覗く（trackしないのでカウントされない） */
function countRoom(chName: string): Promise<number> {
  return new Promise((resolve) => {
    const supabase = createClient();
    const ch = supabase.channel(chName);
    let done = false;
    const finish = (v: number) => {
      if (done) return;
      done = true;
      supabase.removeChannel(ch);
      resolve(v);
    };
    const timer = setTimeout(() => finish(0), 1800);
    ch.on("presence", { event: "sync" }, () => {
      clearTimeout(timer);
      const st = ch.presenceState() as Record<string, Array<{ t?: number }>>;
      finish(Object.keys(st).filter((k) => st[k][0]?.t !== undefined).length);
    });
    ch.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        finish(0);
      }
    });
  });
}

interface Sig {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  cand?: RTCIceCandidateInit;
}

interface ChatMsg {
  from: string;
  name: string;
  body: string;
  t: number;
}

export default function CafePage() {
  const params = useParams<{ pref: string }>();
  const pref = decodeURIComponent(params.pref);
  const [me, setMe] = useState<User | null>(null);
  const [roomKey, setRoomKey] = useState<string | null>(null); // 満席なら「東京都 No.2」など
  const [phase, setPhase] = useState<"lobby" | "joining" | "in">("lobby");
  const [mode, setMode] = useState<Mode>("video");
  const [err, setErr] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false); // ブラウザ設定で拒否されている状態
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [names, setNames] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [roster, setRoster] = useState<Record<string, Mode>>({}); // 在室者（自分含む）とその参加モード
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");

  const localRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pcBorn = useRef<Map<string, number>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const myT = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
  }, []);

  const send = useCallback((payload: Sig) => {
    chRef.current?.send({ type: "broadcast", event: "sig", payload });
  }, []);

  const closePeer = useCallback((peerId: string) => {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);
    pcBorn.current.delete(peerId);
    pendingIce.current.delete(peerId);
    setStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const ensurePc = useCallback(
    (peerId: string, myId: string) => {
      let pc = pcs.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection(ICE);
      pcs.current.set(peerId, pc);
      pcBorn.current.set(peerId, Date.now());
      localStream.current?.getTracks().forEach((t) => pc!.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ from: myId, to: peerId, kind: "ice", cand: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const st = e.streams[0];
        if (st) setStreams((prev) => ({ ...prev, [peerId]: st }));
      };
      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === "failed" || pc!.connectionState === "closed") closePeer(peerId);
      };
      return pc;
    },
    [send, closePeer]
  );

  const flushIce = useCallback(async (peerId: string) => {
    const pc = pcs.current.get(peerId);
    const list = pendingIce.current.get(peerId) ?? [];
    pendingIce.current.delete(peerId);
    for (const c of list) {
      try {
        await pc?.addIceCandidate(c);
      } catch {}
    }
  }, []);

  const handleSig = useCallback(
    async (p: Sig, myId: string) => {
      if (p.to !== myId) return;
      try {
        if (p.kind === "offer" && p.sdp) {
          const pc = ensurePc(p.from, myId);
          await pc.setRemoteDescription(p.sdp);
          await flushIce(p.from);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send({ from: myId, to: p.from, kind: "answer", sdp: pc.localDescription! });
        } else if (p.kind === "answer" && p.sdp) {
          const pc = pcs.current.get(p.from);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(p.sdp);
            await flushIce(p.from);
          }
        } else if (p.kind === "ice" && p.cand) {
          const pc = pcs.current.get(p.from);
          if (pc && pc.remoteDescription) await pc.addIceCandidate(p.cand);
          else {
            const list = pendingIce.current.get(p.from) ?? [];
            list.push(p.cand);
            pendingIce.current.set(p.from, list);
          }
        }
      } catch {}
    },
    [ensurePc, flushIce, send]
  );

  const makeOffer = useCallback(
    async (peerId: string, myId: string) => {
      const pc = ensurePc(peerId, myId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ from: myId, to: peerId, kind: "offer", sdp: pc.localDescription! });
      } catch {}
    },
    [ensurePc, send]
  );

  const leave = useCallback(() => {
    for (const id of Array.from(pcs.current.keys())) closePeer(id);
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (chRef.current) {
      const supabase = createClient();
      supabase.removeChannel(chRef.current);
      chRef.current = null;
    }
    setStreams({});
    setRoster({});
    setChat([]);
    setPhase("lobby");
  }, [closePeer]);

  useEffect(() => leave, [leave]); // アンマウント時に退室

  // 店内画面が表示されてから自分のカメラ映像を挿す（入店時はまだ映像枠が無いため）
  const openNow = Object.keys(roster).length >= OPEN_AT;
  useEffect(() => {
    if (phase === "in" && localRef.current && localStream.current) {
      localRef.current.srcObject = localStream.current;
      localRef.current.play().catch(() => {});
    }
  }, [phase, mode, openNow]);

  // チャットは常に最新へ
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  // 5秒ごとの自己修復: 未接続・切断の相手に接続を張り直す
  useEffect(() => {
    if (phase !== "in" || !me) return;
    const myId = me.id;
    const t = setInterval(() => {
      const ch = chRef.current;
      if (!ch) return;
      const st = ch.presenceState() as Record<string, Array<{ t?: number; mode?: Mode }>>;
      for (const [id, metas] of Object.entries(st)) {
        if (id === myId) continue;
        const theirT = metas[0]?.t;
        if (theirT === undefined) continue;
        // 文字参加同士はWebRTC不要
        if (mode === "text" && metas[0]?.mode === "text") continue;
        const pc = pcs.current.get(id);
        const born = pcBorn.current.get(id) ?? 0;
        const stale =
          !pc ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected" ||
          (pc.connectionState !== "connected" && Date.now() - born > 8000);
        // 後から入った側（offer担当）が張り直す
        if (stale && myT.current > theirT) {
          if (pc) closePeer(id);
          makeOffer(id, myId);
        }
      }
    }, 5000);
    return () => clearInterval(t);
  }, [phase, me, mode, makeOffer, closePeer]);

  const join = async (wanted: Mode) => {
    if (!me || phase !== "lobby") return;
    setErr(null);
    setMode(wanted);
    setPhase("joining");
    let stream: MediaStream | null = null;
    if (wanted !== "text") {
      try {
        if (wanted === "voice") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setCamOn(false);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, facingMode: "user" },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          setCamOn(true);
        }
        setPermDenied(false);
      } catch (e2) {
        const name = (e2 as DOMException)?.name ?? "";
        const noApi = typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia;
        setPermDenied(true);
        setErr(
          noApi
            ? "このブラウザではカメラを使えません（LINEやInstagramの中のブラウザは不可）。SafariかChromeで onesea.vercel.app を開き直してください。"
            : name === "NotAllowedError" || name === "SecurityError"
              ? "カメラ・マイクが許可されていません。下の手順で許可してから、もう一度お試しください。"
              : "カメラ・マイクを使えませんでした。もう一度お試しいただくか、文字だけで参加できます。"
        );
        setPhase("lobby");
        return;
      }
    }
    localStream.current = stream;
    if (localRef.current && stream) localRef.current.srcObject = stream;

    // 満席なら No.2, No.3... と空いているラウンジを探す
    let room = pref;
    for (let n = 1; n <= 20; n++) {
      const key = n === 1 ? pref : `${pref} No.${n}`;
      const c = await countRoom(`cafe:${key}`);
      if (c < ROOM_CAP) {
        room = key;
        break;
      }
    }
    setRoomKey(room);

    const supabase = createClient();
    const myId = me.id;
    myT.current = Date.now();
    const ch = supabase.channel(`cafe:${room}`, {
      config: { presence: { key: myId }, broadcast: { self: false } },
    });
    chRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ t?: number; mode?: Mode }>>;
      const ids = Object.keys(state).filter((k) => state[k][0]?.t !== undefined);
      const ro: Record<string, Mode> = {};
      for (const id of ids) ro[id] = state[id][0]?.mode ?? "video";
      setRoster(ro);
      // 後から入った人（joinTimeが大きい方）がofferを出す — 衝突しない。
      // 文字同士はメディアが無いので張らない
      for (const id of ids) {
        if (id === myId || pcs.current.has(id)) continue;
        if (wanted === "text" && ro[id] === "text") continue;
        const theirT = state[id][0]?.t ?? 0;
        if (myT.current > theirT) makeOffer(id, myId);
      }
      // 名前とアバター
      const sb = createClient();
      sb.from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids)
        .then(({ data }) => {
          const m: Record<string, { name: string; avatar: string | null }> = {};
          for (const p of data ?? []) m[p.id] = { name: p.display_name ?? "むらびと", avatar: p.avatar_url };
          setNames(m);
        });
    });
    ch.on("presence", { event: "leave" }, ({ key }) => closePeer(key as string));
    ch.on("broadcast", { event: "sig" }, ({ payload }) => handleSig(payload as Sig, myId));
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      setChat((prev) => [...prev.slice(-79), payload as ChatMsg]);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ t: myT.current, mode: wanted });
        setPhase("in");
      }
    });
  };

  const sendChat = () => {
    const body = draft.trim();
    if (!body || !me) return;
    const msg: ChatMsg = {
      from: me.id,
      name: names[me.id]?.name ?? (me.user_metadata?.name as string) ?? "むらびと",
      body,
      t: Date.now(),
    };
    chRef.current?.send({ type: "broadcast", event: "chat", payload: msg });
    setChat((prev) => [...prev.slice(-79), msg]); // broadcast.self=false なので自分の分は手元で足す
    setDraft("");
  };

  const toggleMic = () => {
    const on = !micOn;
    setMicOn(on);
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = on));
  };
  const toggleCam = () => {
    const on = !camOn;
    setCamOn(on);
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = on));
  };

  const rosterIds = Object.keys(roster);
  const count = rosterIds.length;
  const mediaIds = rosterIds.filter((id) => id !== me?.id && roster[id] !== "text");
  const textIds = rosterIds.filter((id) => roster[id] === "text");
  const avatarOf = (id: string) =>
    names[id]?.avatar ? (
      <img src={srcCdn(names[id]!.avatar!) ?? undefined} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
    ) : (
      <span className="text-[34px]">🍵</span>
    );

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "linear-gradient(165deg,#171310,#241c14)" }}>
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <Link href="/sekai" className="text-[13px] font-bold text-[#c8a878] no-underline">
          ◀ セカイムラ
        </Link>
        <div className="text-center">
          <div className="text-[14px] font-extrabold tracking-[1px] text-[#f0e2c8]">☕ {roomKey ?? pref} 村人ラウンジ喫茶</div>
          <div className="text-[9.5px] tracking-[2px] text-[#8a7a60]">〜いつでもオープン〜</div>
        </div>
        <span className="w-16 text-right text-[11px] text-[#8a7a60]">{phase === "in" ? `${count}人` : ""}</span>
      </header>

      {phase !== "in" ? (
        /* ─── ロビー: 参加のかたちを選ぶ ─── */
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
          <div className="text-[56px]">☕</div>
          <h1 className="mt-3 text-[18px] font-extrabold leading-relaxed text-[#f0e2c8]">
            {pref}のラウンジは
            <br />
            いつでも開いています
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-[#a89878]">
            3人以上が揃うと、ラウンジがオープンします。
            <br />
            参加のかたちは、揃う前に選んでおけます。
          </p>
          {err && (
            <div className="mt-3 w-full max-w-[340px] rounded-xl border border-[#6a4a38] bg-[#2a1c14] px-4 py-3 text-left">
              <p className="text-[12px] font-bold text-[#e0906a]">{err}</p>
              {permDenied && (
                <div className="mt-2.5 text-[10.5px] leading-relaxed text-[#c8a888]">
                  📱 <b>iPhone (Safari)</b>: 設定アプリ →「Safari」→「カメラ」「マイク」を「確認」または「許可」に。
                  アドレスバー左の「ぁあ」→ Webサイトの設定でも変更できます。直したらページを開き直してください。
                  <br />
                  🤖 <b>Android (Chrome)</b>: アドレスバーの🔒 → 権限 → カメラ/マイクを許可 → 再読み込み
                  <br />
                  ⚠️ LINE等の中から開いている場合は「Safariで開く」が先に必要です
                </div>
              )}
            </div>
          )}
          {me ? (
            <div className="mt-6 grid w-full max-w-[320px] gap-2.5">
              <button
                onClick={() => join("video")}
                disabled={phase === "joining"}
                className="rounded-2xl py-3.5 text-[15px] font-extrabold text-[#241c14] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#e8cc90,#c8a860)", boxShadow: "0 4px 24px rgba(200,168,96,.35)" }}
              >
                🎥 カメラで話す
              </button>
              <button
                onClick={() => join("voice")}
                disabled={phase === "joining"}
                className="rounded-2xl border border-[#c8a86066] py-3 text-[13.5px] font-bold text-[#e8d5a8] disabled:opacity-50"
              >
                🎙 声だけで話す（顔なし）
              </button>
              <button
                onClick={() => join("text")}
                disabled={phase === "joining"}
                className="rounded-2xl border border-[#c8a86044] py-3 text-[13.5px] font-bold text-[#c8b088] disabled:opacity-50"
              >
                💬 文字だけで話す
              </button>
              {phase === "joining" && <p className="text-[11px] text-[#a89878]">入店中...</p>}
            </div>
          ) : (
            <p className="mt-6 text-[12px] text-[#a89878]">ログインすると入れます</p>
          )}
          <p className="mt-4 text-[9.5px] leading-relaxed text-[#6a5a48]">
            1ラウンジ {ROOM_CAP}人まで。満席のときは No.2 が自動で開きます
          </p>
        </div>
      ) : (
        /* ─── 店内 ─── */
        <div className="flex flex-1 flex-col px-3 pb-3">
          {!openNow ? (
            /* 開店待ち: 3人揃うまで */
            <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
              <div className="flex items-center justify-center">
                {rosterIds.map((id, i) => (
                  <span
                    key={id}
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#c8a860] bg-[#2a2118]"
                    style={{ marginLeft: i === 0 ? 0 : -10 }}
                  >
                    {avatarOf(id)}
                  </span>
                ))}
                {Array.from({ length: Math.max(0, OPEN_AT - count) }).map((_, i) => (
                  <span
                    key={`empty-${i}`}
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#5a4a34] text-[18px] text-[#5a4a34]"
                    style={{ marginLeft: -10 }}
                  >
                    ?
                  </span>
                ))}
              </div>
              <h2 className="mt-4 text-[16px] font-extrabold leading-relaxed text-[#f0e2c8]">
                3人以上が揃うと、
                <br />
                ラウンジがオープンします
              </h2>
              <div className="mt-1.5 text-[20px] font-extrabold text-[#e8cc90]">
                あと{Math.max(0, OPEN_AT - count)}人
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#a89878]">
                このページを開いたまま、お茶でもどうぞ。
                <br />
                揃った瞬間、自動でつながります（接続は準備済み）
              </p>
            </div>
          ) : (
            /* オープン: 映像グリッド（文字参加の人はチャットに） */
            <div className={`grid gap-2 ${count - textIds.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`} style={{ alignContent: "start" }}>
              {mediaIds.map((id) => {
                const st = streams[id];
                const hasVideo = !!st && st.getVideoTracks().length > 0;
                return (
                  <div key={id} className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3/4" }}>
                    {st && (
                      <video
                        autoPlay
                        playsInline
                        className="h-full w-full object-cover"
                        ref={(el) => {
                          if (el && el.srcObject !== st) el.srcObject = st;
                        }}
                      />
                    )}
                    {!hasVideo && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#2a2118]">
                        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[#c8a860]">
                          {avatarOf(id)}
                        </span>
                        <span className="text-[10px] font-bold text-[#c8b088]">🎙 声で参加中</span>
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-white">
                      {names[id]?.name ?? "むらびと"}
                    </span>
                  </div>
                );
              })}
              {/* 自分 */}
              {mode !== "text" && (
                <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3/4", opacity: 0.95 }}>
                  <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  {(mode === "voice" || !camOn) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#2a2118] text-[34px]">🍵</div>
                  )}
                  <span className="absolute bottom-1.5 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-[#e8cc90]">
                    あなた{micOn ? "" : "（ミュート中）"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 💬 チャット（文字参加の人の主戦場。全員読める） */}
          <div className="mt-2.5 flex max-h-[30vh] min-h-[96px] flex-col rounded-xl border border-[#3a3226] bg-[#1e1811]">
            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
              {textIds.length > 0 && (
                <div className="pb-0.5 text-[9.5px] text-[#6a5a48]">
                  💬 文字で参加: {textIds.map((id) => names[id]?.name ?? "むらびと").join("・")}
                </div>
              )}
              {chat.length === 0 && <div className="text-[10.5px] text-[#6a5a48]">ここに文字のおしゃべりが流れます</div>}
              {chat.map((m, i) => (
                <div key={m.t + "-" + i} className="text-[12.5px] leading-relaxed text-[#e8dcc8]">
                  <span className="mr-1.5 font-bold text-[#c8a860]">{m.name}</span>
                  <span className="break-words">{m.body}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-[#3a3226] px-2 py-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChat();
                }}
                placeholder="メッセージ..."
                className="min-w-0 flex-1 rounded-full border border-[#4a3c28] bg-[#241c14] px-3 py-1.5 text-[13px] text-[#f0e2c8] outline-none placeholder:text-[#6a5a48]"
              />
              <button
                onClick={sendChat}
                disabled={!draft.trim()}
                className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-[#241c14] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#e8cc90,#c8a860)" }}
              >
                送る
              </button>
            </div>
          </div>

          {/* コントロール */}
          <div className="mt-2.5 flex items-center justify-center gap-3">
            {mode !== "text" && (
              <button
                onClick={toggleMic}
                className="flex h-12 w-12 items-center justify-center rounded-full text-[18px]"
                style={micOn ? { background: "#3a3226", color: "#e8cc90" } : { background: "#c05040", color: "#fff" }}
                aria-label="マイク"
              >
                {micOn ? "🎙" : "🔇"}
              </button>
            )}
            {mode === "video" && (
              <button
                onClick={toggleCam}
                className="flex h-12 w-12 items-center justify-center rounded-full text-[18px]"
                style={camOn ? { background: "#3a3226", color: "#e8cc90" } : { background: "#c05040", color: "#fff" }}
                aria-label="カメラ"
              >
                {camOn ? "🎥" : "🚫"}
              </button>
            )}
            <button onClick={leave} className="rounded-full px-6 py-3 text-[13.5px] font-extrabold text-white" style={{ background: "#a04030" }}>
              退店する
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
