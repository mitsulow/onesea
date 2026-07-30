"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

/**
 * ブラウザ用 Supabase クライアント（楽市楽座と同一プロジェクト＝共通アカウント）。
 * cookie + localStorage 併用でモバイルブラウザでもセッションが残る。
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
      sameSite: "lax",
      secure:
        typeof window !== "undefined" && window.location.protocol === "https:",
    },
  });
}
