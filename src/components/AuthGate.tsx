"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Onboarding } from "./Onboarding";

/**
 * ログインゲート。onesea.vercel.app にアクセスしたら、まず
 * 「Googleでログインしてください」。ログイン後に本体を表示する。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false); // 無料アプリとしてログインせず使う

  useEffect(() => {
    try {
      if (localStorage.getItem("onesea-guest") === "1") setGuest(true);
    } catch {}
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setOnboarded(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setOnboarded(!!data?.onboarded_at));
  }, [user]);

  const login = async () => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (error) setError(error.message);
  };

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (guest) return <>{children}</>; // 無料アプリモード（投稿系はUpgradeGateが守る）
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-7 py-9 text-center"
        style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
      >
        <svg width="180" height="180" viewBox="0 0 200 200" className="mb-2">
          <circle cx="100" cy="88" r="52" fill="none" stroke="#D4B96A" strokeWidth="6" />
          <path
            d="M8 150 Q 40 136 72 150 T 136 150 T 200 150"
            fill="none"
            stroke="#7AB8D8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M-8 168 Q 24 156 56 168 T 120 168 T 184 168 T 248 168"
            fill="none"
            stroke="#3E7A9C"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="text-[38px] font-extrabold tracking-[6px] text-[#f0e6c8]">Onesea</h1>
        <div className="mb-3.5 mt-1 text-xs tracking-[5px] text-[#9ab8cc]">ワ ン シ ー</div>
        <p className="mb-8 text-base tracking-widest text-[#d8e4ec]">すべての海は、ひとつ。</p>
        <p className="mb-6 text-[14.5px] leading-loose text-[#b8ccda]">
          太陽と月と潮のリズムで生きる
          <br />
          <b className="text-[#e8dcb8]">無料の手帳アプリ</b>です。
        </p>
        <button
          onClick={login}
          className="flex w-full max-w-[300px] items-center justify-center gap-3 rounded-2xl bg-white py-3.5 text-[15px] font-extrabold text-[#3a3428] shadow-lg"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.4 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Google でログインしてください
        </button>
        <button
          onClick={() => {
            try {
              localStorage.setItem("onesea-guest", "1");
            } catch {}
            setGuest(true);
          }}
          className="mt-3 w-full max-w-[300px] rounded-2xl border border-white/25 py-3 text-[13px] font-bold text-[#c8d8e4]"
        >
          ログインせずに無料で使ってみる →
        </button>
        {error && <p className="mt-4 text-xs text-[#e0a0a0]">エラー: {error}</p>}
        <p className="mt-8 text-[11.5px] leading-loose text-[#5a7a92]">
          冬至から冬至までの一年を、360の
          <br />
          <b className="text-[#8aa8bc]">節分かれつ刻（フシワカレツトキ）</b>で刻みます
        </p>
      </div>
    );
  }

  if (onboarded === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" />
      </div>
    );
  }

  if (!onboarded) {
    return <Onboarding user={user} onDone={() => setOnboarded(true)} />;
  }

  return <>{children}</>;
}
