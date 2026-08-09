"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";

/**
 * ビデオ通話の着信 — OneSeaのどのページに居ても、上からポップアップが垂れてくる。
 * 「応答」でそのTALKの通話に入り、「拒否」で相手に自動でお断りメッセージ。
 * 検知はSupabase Realtime(挿入をプッシュ受信)なのでポーリング負荷なし。
 */
interface Ring {
  id: string;
  chat_id: string;
  caller_id: string;
  name: string;
  avatar: string | null;
}

export function CallRingListener() {
  const [ring, setRing] = useState<Ring | null>(null);
  const meRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      meRef.current = uid;
      const show = async (row: { id: string; chat_id: string; caller_id: string; created_at: string }) => {
        if (Date.now() - Date.parse(row.created_at) > 45000) return; // 古い呼び出しは無視
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", row.caller_id)
          .maybeSingle();
        setRing({
          id: row.id,
          chat_id: row.chat_id,
          caller_id: row.caller_id,
          name: p?.display_name ?? "むらびと",
          avatar: p?.avatar_url ?? null,
        });
        try {
          navigator.vibrate?.([300, 120, 300, 120, 300]);
        } catch {}
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setRing(null), 40000); // 40秒で自動的に引っ込む
      };
      // 着信のリアルタイム購読
      channel = supabase
        .channel("call-rings")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_rings", filter: `callee_id=eq.${uid}` },
          (payload) => void show(payload.new as never)
        )
        .subscribe();
      // 開いた瞬間に鳴っている最中の呼び出しが無いかも1回だけ確認
      supabase
        .from("call_rings")
        .select("id, chat_id, caller_id, created_at")
        .eq("callee_id", uid)
        .eq("status", "ringing")
        .gte("created_at", new Date(Date.now() - 40000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) void show(data[0]);
        });
    });
    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, []);

  if (!ring) return null;

  const answer = async () => {
    const supabase = createClient();
    await supabase.from("call_rings").update({ status: "accepted" }).eq("id", ring.id);
    setRing(null);
    router.push(`/talk/${ring.chat_id}?call=1`);
  };
  const decline = async () => {
    const supabase = createClient();
    await supabase.from("call_rings").update({ status: "declined" }).eq("id", ring.id);
    try {
      const { sendMessage } = await import("@/lib/line");
      if (meRef.current) await sendMessage(ring.chat_id, meRef.current, "いまは電話に出られません🙏");
    } catch {}
    setRing(null);
  };

  return (
    <div
      className="fixed left-1/2 z-[200] w-[calc(100%-24px)] max-w-[400px] -translate-x-1/2"
      style={{ top: "calc(env(safe-area-inset-top) + 10px)", animation: "ringDrop .35s cubic-bezier(0.2,0.9,0.3,1.1)" }}
    >
      <style>{`@keyframes ringDrop { 0% { transform: translate(-50%, -120%); } 100% { transform: translate(-50%, 0); } }`}</style>
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl" style={{ background: "#12251a", border: "1px solid #2a5a3a" }}>
        {ring.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={srcCdn(ring.avatar)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#2a5a3a] text-[18px]">📞</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-extrabold text-white">{ring.name}</div>
          <div className="text-[11px] text-[#8fd0a8]">📞 ビデオ通話の着信…</div>
        </div>
        <button
          onClick={decline}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[17px]"
          style={{ background: "#c03030" }}
          aria-label="拒否"
        >
          ✕
        </button>
        <button
          onClick={answer}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[17px]"
          style={{ background: "#2a9a5a", animation: "ringPulse 1.1s ease-in-out infinite" }}
          aria-label="応答"
        >
          📞
        </button>
        <style>{`@keyframes ringPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }`}</style>
      </div>
    </div>
  );
}
