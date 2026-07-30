"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";

/**
 * Cotozute 書き込み欄。
 * 楽市楽座と共通の Supabase アカウントでログインし、その場で言の葉を投げる。
 */
export function CotozuteComposer({ onPosted }: { onPosted?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (error) setMessage(`ログインエラー: ${error.message}`);
  };

  const submit = async () => {
    if (!user || !body.trim() || sending) return;
    setSending(true);
    setMessage(null);
    const supabase = createClient();

    await ensureProfile(user);

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      body: body.trim(),
      image_urls: [],
    });

    setSending(false);
    if (error) {
      setMessage(`投げられませんでした: ${error.message}`);
      return;
    }
    setBody("");
    setMessage("言の葉を投げました 🌿");
    onPosted?.();
  };

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mb-2 rounded-xl border border-[#e8dcc4] bg-white p-3 text-center">
        <p className="mb-2 text-[12.5px] leading-relaxed text-[#8a8070]">
          いまの気持ちを、ひとこと。
        </p>
        <button
          onClick={login}
          className="w-full rounded-xl py-3 text-[14px] font-extrabold text-white"
          style={{ background: "#c94d3a" }}
        >
          ログインして言の葉を投げる
        </button>
        {message && <p className="mt-2 text-[11px] text-[#c05030]">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="いまの気持ちを、ひとこと..."
        rows={2}
        className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#c0b8a8]">{message ?? ""}</span>
        <button
          onClick={submit}
          disabled={!body.trim() || sending}
          className="rounded-xl px-5 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
          style={{ background: "#c94d3a" }}
        >
          {sending ? "投げかけ中..." : "💭 投げる"}
        </button>
      </div>
    </div>
  );
}
