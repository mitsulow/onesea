"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("ログイン処理中...");

  useEffect(() => {
    const supabase = createClient();

    // ログイン前に localStorage へ入れた戻り先（/join/complete 等）があればそこへ
    const dest = (() => {
      try {
        const d = localStorage.getItem("onesea-return");
        if (d && d.startsWith("/")) {
          localStorage.removeItem("onesea-return");
          return d;
        }
      } catch {}
      return "/";
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(dest);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(dest);
    });

    const timeout = setTimeout(() => setStatus("ログインに失敗しました"), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
        <p className="text-sm text-[#8a8070]">{status}</p>
        {status.includes("失敗") && (
          <a href="/" className="block text-xs text-[#c94d3a] underline">
            トップへもどる
          </a>
        )}
      </div>
    </div>
  );
}
