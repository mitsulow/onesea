"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/* eslint-disable @next/next/no-img-element */

/**
 * ラウンジ喫茶 — 県ごとに常時オープンのビデオ通話ルーム。
 * Zoom を使わず、ブラウザの WebRTC（P2Pメッシュ）で顔を見て話せる。
 * シグナリング・在室者は Supabase Realtime（presence + broadcast）。
 * サーバー費用ゼロ。喫茶店的な少人数（〜6人目安）のおしゃべり向き。
 */

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** 1ルームの上限（P2Pメッシュが快適な人数）。超えたら No.2, No.3... が自動で開く */
const ROOM_CAP = 5;

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

export default function CafePage() {
  const params = useParams<{ pref: string }>();
  const pref = decodeURIComponent(params.pref);
  const [me, setMe] = useState<User | null>(null);
  const [roomKey, setRoomKey] = useState<string | null>(null); // 満席なら「東京都 No.2」など
  const [phase, setPhase] = useState<"lobby" | "joining" | "in">("lobby");
  const [err, setErr] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [names, setNames] = useState<Record<string, { name: string; avatar: string | null }>>({});

  const localRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const myT = useRef(0);

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
    setPhase("lobby");
  }, [closePeer]);

  useEffect(() => leave, [leave]); // アンマウント時に退室

  const join = async () => {
    if (!me || phase !== "lobby") return;
    setErr(null);
    setPhase("joining");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioOnly(true);
        setCamOn(false);
      } catch {
        setErr("カメラ・マイクを使えませんでした。ブラウザの許可を確認してください。");
        setPhase("lobby");
        return;
      }
    }
    localStream.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;

    // 満席なら No.2, No.3... と空いている店を探す
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
      const state = ch.presenceState() as Record<string, Array<{ t?: number; name?: string }>>;
      const ids = Object.keys(state).filter((k) => state[k][0]?.t !== undefined);
      // 後から入った人（joinTimeが大きい方）がofferを出す — 衝突しない
      for (const id of ids) {
        if (id === myId || pcs.current.has(id)) continue;
        const theirT = state[id][0]?.t ?? 0;
        if (myT.current > theirT) makeOffer(id, myId);
      }
      // 名前
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
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ t: myT.current, name: me.user_metadata?.name ?? "" });
        setPhase("in");
      }
    });
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

  const peers = Object.entries(streams);

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "linear-gradient(165deg,#171310,#241c14)" }}>
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <Link href="/sekai" className="text-[13px] font-bold text-[#c8a878] no-underline">
          ◀ セカイムラ
        </Link>
        <div className="text-center">
          <div className="text-[14px] font-extrabold tracking-[1px] text-[#f0e2c8]">☕ {roomKey ?? pref} 村人ラウンジ喫茶</div>
          <div className="text-[9.5px] tracking-[2px] text-[#8a7a60]">常時オープン</div>
        </div>
        <span className="w-16 text-right text-[11px] text-[#8a7a60]">
          {phase === "in" ? `${peers.length + 1}人` : ""}
        </span>
      </header>

      {phase !== "in" ? (
        /* ─── ロビー ─── */
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
          <div className="text-[56px]">☕</div>
          <h1 className="mt-3 text-[18px] font-extrabold leading-relaxed text-[#f0e2c8]">
            {pref}の喫茶店は
            <br />
            いつでも開いています
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-[#a89878]">
            誰かが来たら、顔を見ながらお話しできます。
            <br />
            誰もいなくても、お茶を飲みながら待つのも良い時間。
          </p>
          {err && <p className="mt-3 text-[12px] text-[#e08060]">{err}</p>}
          {me ? (
            <button
              onClick={join}
              disabled={phase === "joining"}
              className="mt-6 rounded-2xl px-10 py-4 text-[16px] font-extrabold text-[#241c14] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#e8cc90,#c8a860)", boxShadow: "0 4px 24px rgba(200,168,96,.35)" }}
            >
              {phase === "joining" ? "入店中..." : "☕ 喫茶店に入る"}
            </button>
          ) : (
            <p className="mt-6 text-[12px] text-[#a89878]">ログインすると入れます</p>
          )}
          <p className="mt-4 text-[9.5px] leading-relaxed text-[#6a5a48]">
            カメラとマイクの許可が必要です（音声だけの参加もOK）
            <br />1店 {ROOM_CAP}人まで。満席のときは No.2 のお店が自動で開きます
          </p>
        </div>
      ) : (
        /* ─── 店内 ─── */
        <div className="flex flex-1 flex-col px-3 pb-3">
          {peers.length === 0 && (
            <div className="mb-2 rounded-xl border border-[#4a3c28] bg-[#2a2118] px-4 py-3 text-center text-[12px] leading-relaxed text-[#c8b088]">
              まだあなただけ。このページを開いたまま待つと、
              <br />
              誰かが入店したときに自動でつながります ☕
            </div>
          )}
          <div className={`grid flex-1 gap-2 ${peers.length <= 1 ? "grid-cols-1" : "grid-cols-2"}`} style={{ alignContent: "start" }}>
            {peers.map(([id, st]) => (
              <div key={id} className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3/4" }}>
                <video
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                  ref={(el) => {
                    if (el && el.srcObject !== st) el.srcObject = st;
                  }}
                />
                <span className="absolute bottom-1.5 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-white">
                  {names[id]?.name ?? "むらびと"}
                </span>
              </div>
            ))}
            {/* 自分（小さめ） */}
            <div
              className={`relative overflow-hidden rounded-2xl bg-black ${peers.length === 0 ? "" : ""}`}
              style={{ aspectRatio: "3/4", opacity: 0.95 }}
            >
              <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
              {(!camOn || audioOnly) && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#2a2118] text-[34px]">🍵</div>
              )}
              <span className="absolute bottom-1.5 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-[#e8cc90]">
                あなた{micOn ? "" : "（ミュート中）"}
              </span>
            </div>
          </div>

          {/* コントロール */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              onClick={toggleMic}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[18px]"
              style={micOn ? { background: "#3a3226", color: "#e8cc90" } : { background: "#c05040", color: "#fff" }}
              aria-label="マイク"
            >
              {micOn ? "🎙" : "🔇"}
            </button>
            {!audioOnly && (
              <button
                onClick={toggleCam}
                className="flex h-12 w-12 items-center justify-center rounded-full text-[18px]"
                style={camOn ? { background: "#3a3226", color: "#e8cc90" } : { background: "#c05040", color: "#fff" }}
                aria-label="カメラ"
              >
                {camOn ? "🎥" : "🚫"}
              </button>
            )}
            <button
              onClick={leave}
              className="rounded-full px-6 py-3 text-[13.5px] font-extrabold text-white"
              style={{ background: "#a04030" }}
            >
              退店する
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
