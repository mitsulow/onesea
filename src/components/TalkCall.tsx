"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * TALKの1対1通話。まず電話(音声のみ)でつながり、「ビデオ通話にする」で映像を追加できる。ラウンジ喫茶と同じWebRTC(P2P)+Supabase Realtimeで、
 * サーバー費用ゼロ。チャンネルは talkcall:{chatId}（チャット当事者だけが知るID）。
 * 呼び出しは「📞メッセージ」を送る方式 — 相手には未読/プッシュで届き、
 * TALKを開くと「通話中 — 参加する」バナーから合流できる。
 */

const ICE = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

interface Sig {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  cand?: RTCIceCandidateInit;
}

/** 通話ルームの在室人数を覗く（trackしないのでカウントされない） */
export function peekCall(chatId: string): Promise<number> {
  return new Promise((resolve) => {
    const supabase = createClient();
    const ch = supabase.channel(`talkcall:${chatId}`);
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

export function TalkCall({
  chatId,
  me,
  partnerName,
  onClose,
}: {
  chatId: string;
  me: User;
  partnerName: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"joining" | "waiting" | "in">("joining");
  const [err, setErr] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [audioOnly, setAudioOnly] = useState(true); // 📞 まず電話(音声のみ)で始まる
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [rv, setRv] = useState(0); // 相手の映像が後から増えた時に再描画するためのカウンタ
  void rv;

  const localRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const myT = useRef(0);
  const peerId = useRef<string | null>(null);

  const send = useCallback((payload: Sig) => {
    chRef.current?.send({ type: "broadcast", event: "sig", payload });
  }, []);

  const closePc = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingIce.current = [];
    setRemote(null);
  }, []);

  const ensurePc = useCallback(
    (pid: string) => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      peerId.current = pid;
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ from: me.id, to: pid, kind: "ice", cand: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemote(e.streams[0]);
          setRv((v) => v + 1); // ビデオ昇格で相手の映像トラックが増えた時も画面を更新
          e.streams[0].onaddtrack = () => setRv((v) => v + 1);
          e.streams[0].onremovetrack = () => setRv((v) => v + 1);
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "failed" || s === "closed") closePc();
      };
      return pc;
    },
    [me.id, send, closePc]
  );

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    const list = pendingIce.current;
    pendingIce.current = [];
    for (const c of list) {
      try {
        await pc?.addIceCandidate(c);
      } catch {}
    }
  }, []);

  const makeOffer = useCallback(
    async (pid: string) => {
      const pc = ensurePc(pid);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ from: me.id, to: pid, kind: "offer", sdp: pc.localDescription! });
      } catch {}
    },
    [ensurePc, me.id, send]
  );

  const handleSig = useCallback(
    async (p: Sig) => {
      if (p.to !== me.id) return;
      try {
        if (p.kind === "offer" && p.sdp) {
          const pc = ensurePc(p.from);
          await pc.setRemoteDescription(p.sdp);
          await flushIce();
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send({ from: me.id, to: p.from, kind: "answer", sdp: pc.localDescription! });
        } else if (p.kind === "answer" && p.sdp) {
          const pc = pcRef.current;
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(p.sdp);
            await flushIce();
          }
        } else if (p.kind === "ice" && p.cand) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) await pc.addIceCandidate(p.cand);
          else pendingIce.current.push(p.cand);
        }
      } catch {}
    },
    [me.id, ensurePc, flushIce, send]
  );

  const hangup = useCallback(() => {
    closePc();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (chRef.current) {
      const supabase = createClient();
      supabase.removeChannel(chRef.current);
      chRef.current = null;
    }
    onClose();
  }, [closePc, onClose]);

  /* 参加（マウント時に1回） */
  useEffect(() => {
    let disposed = false;
    (async () => {
      let stream: MediaStream | null = null;
      try {
        // 📞 電話: まずマイクだけ。ビデオは「ビデオ通話にする」を押した時に追加
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        if (!disposed) {
          setErr("マイクを使えませんでした。ブラウザの許可設定を確認してください。");
        }
        return;
      }
      if (disposed) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      localStream.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      const supabase = createClient();
      myT.current = Date.now();
      const ch = supabase.channel(`talkcall:${chatId}`, {
        config: { presence: { key: me.id }, broadcast: { self: false } },
      });
      chRef.current = ch;
      ch.on("presence", { event: "sync" }, () => {
        const st = ch.presenceState() as Record<string, Array<{ t?: number }>>;
        const others = Object.keys(st).filter((k) => k !== me.id && st[k][0]?.t !== undefined);
        if (others.length === 0) {
          setPhase("waiting");
          return;
        }
        setPhase("in");
        const pid = others[0];
        const theirT = st[pid][0]?.t ?? 0;
        // 後から入った側がofferを出す — 衝突しない
        if (!pcRef.current && myT.current > theirT) makeOffer(pid);
      });
      ch.on("presence", { event: "leave" }, ({ key }) => {
        if (key === peerId.current) {
          closePc();
          setPhase("waiting");
        }
      });
      ch.on("broadcast", { event: "sig" }, ({ payload }) => handleSig(payload as Sig));
      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ t: myT.current });
      });
    })();
    return () => {
      disposed = true;
      // 「通話を終える」を押さずに離脱（ルート遷移・戻る）してもカメラとRealtimeを確実に後始末
      pcRef.current?.close();
      pcRef.current = null;
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      if (chRef.current) {
        const supabase = createClient();
        supabase.removeChannel(chRef.current);
        chRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, me.id]);

  // 自己修復: 接続が育たない場合に張り直し（後から入った側だけ）
  useEffect(() => {
    const t = setInterval(() => {
      const ch = chRef.current;
      if (!ch) return;
      const st = ch.presenceState() as Record<string, Array<{ t?: number }>>;
      const others = Object.keys(st).filter((k) => k !== me.id && st[k][0]?.t !== undefined);
      if (others.length === 0) return;
      const pid = others[0];
      const theirT = st[pid][0]?.t ?? 0;
      const pc = pcRef.current;
      const bad = !pc || ["failed", "closed", "disconnected"].includes(pc.connectionState);
      if (bad && myT.current > theirT) {
        closePc();
        makeOffer(pid);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [me.id, makeOffer, closePc]);

  /* 📹 ビデオ通話にする: カメラを許可して映像トラックを追加 → 再ネゴシエーション。
     相手も同じボタンを押してカメラを許可したら、お互いの顔が映る */
  const enableVideo = async () => {
    if (!audioOnly) return;
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, facingMode: "user" } });
      const track = vs.getVideoTracks()[0];
      if (!track) throw new Error("no cam");
      localStream.current?.addTrack(track);
      if (localRef.current) localRef.current.srcObject = localStream.current;
      setAudioOnly(false);
      setCamOn(true);
      const pc = pcRef.current;
      if (pc && peerId.current) {
        pc.addTrack(track, localStream.current!);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ from: me.id, to: peerId.current, kind: "offer", sdp: pc.localDescription! });
        } catch {}
      }
    } catch {
      alert("カメラを許可できませんでした。ブラウザの設定を確認してください");
    }
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

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#0e1116]">
      {/* 相手（メイン画面） */}
      <div className="relative flex-1 overflow-hidden">
        {remote ? (
          <video
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            ref={(el) => {
              if (el && el.srcObject !== remote) el.srcObject = remote;
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="text-[42px]">📞</div>
            <div className="text-[15px] font-extrabold text-[#e8ecf4]">
              {err ?? (phase === "waiting" ? `${partnerName}さんを呼んでいます…` : remote ? `${partnerName}さんと通話中` : "つないでいます…")}
            </div>
            {phase === "waiting" && !err && (
              <p className="px-8 text-[11.5px] leading-relaxed text-[#8b93a8]">
                相手のTALKに「📞」のお知らせが届いています。
                <br />
                相手がTALKを開いて参加すると、ここに顔が映ります。
              </p>
            )}
          </div>
        )}
        {remote && remote.getVideoTracks().length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#141a24]">
            <div className="text-[42px]">🎙</div>
            <div className="text-[13px] font-bold text-[#c8d2e0]">{partnerName}さんと通話中（電話）</div>
            <p className="px-8 text-center text-[10.5px] leading-relaxed text-[#7b8398]">お互いが「ビデオ通話にする」を押すと、顔が映ります</p>
          </div>
        )}
        {/* 自分（右下の小窓） */}
        <div className="absolute bottom-3 right-3 w-[104px] overflow-hidden rounded-xl border border-white/25 bg-black shadow-lg" style={{ aspectRatio: "3/4" }}>
          <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {(audioOnly || !camOn) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a2230]"><img src="/icons/icon-tea.webp" alt="" style={{ width: 24, height: 24 }} /></div>
          )}
        </div>
      </div>

      {/* コントロール */}
      <div className="flex items-center justify-center gap-4 pb-8 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        <button
          onClick={toggleMic}
          className="flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-[19px]"
          style={micOn ? { background: "#2a3242", color: "#e8ecf4" } : { background: "#c05040", color: "#fff" }}
          aria-label="マイク"
        >
          {micOn ? "🎙" : "🔇"}
        </button>
        {audioOnly && (
          <button
            onClick={enableVideo}
            className="rounded-full px-4 py-3.5 text-[12.5px] font-extrabold text-white"
            style={{ background: "#2a6ab0" }}
          >
            📹 ビデオ通話にする
          </button>
        )}
        {!audioOnly && (
          <button
            onClick={toggleCam}
            className="flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-[19px]"
            style={camOn ? { background: "#2a3242", color: "#e8ecf4" } : { background: "#c05040", color: "#fff" }}
            aria-label="カメラ"
          >
            {camOn ? <img src="/icons/icon-video.webp" alt="" style={{ width: 22, height: 22 }} /> : "🚫"}
          </button>
        )}
        <button onClick={hangup} className="rounded-full px-7 py-3.5 text-[14px] font-extrabold text-white" style={{ background: "#d04030" }}>
          通話を終える
        </button>
      </div>
    </div>
  );
}
