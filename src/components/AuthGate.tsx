"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Onboarding } from "./Onboarding";

/**
 * 入口ゲート — 三層構造の①「通りすがり」を最優先にした設計。
 * 未ログインでも本体をそのまま表示する（ログイン壁なし）。
 * 登録は右上の「はじめる」ピル（AvatarMenu）や各所のUpgradeGateから。
 * ログイン済みで未登録（onboarded_atなし）の人にだけ初回登録を出す。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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
      .select("onboarded_at, display_name")
      .eq("id", user.id)
      .maybeSingle()
      // display_name が既にある人（マイページ済み等）にも再登録は求めない
      .then(({ data }) => setOnboarded(!!data?.onboarded_at || !!data?.display_name));
  }, [user]);

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

  // 通りすがり（未ログイン）はそのまま本体へ
  if (!user) return <>{children}</>;

  // ログイン済みで初回登録がまだ → 登録フォーム（完了画面で①無料/②わらわ〜の2択）
  if (onboarded === false) {
    return <Onboarding user={user} onDone={() => setOnboarded(true)} />;
  }

  // onboarded === null（確認中）は本体を見せておく（ちらつき防止）
  return <>{children}</>;
}
