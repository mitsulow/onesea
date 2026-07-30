"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** ヘッダー: 右上のアイコンだけ。押すと自分のマイページへ */
export function HeaderBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const meta = user?.user_metadata ?? {};
  const avatar = (meta.avatar_url as string) ?? null;

  return (
    <header
      className="flex items-center justify-between px-5 pb-3 pt-4"
      style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
    >
      <h1 className="text-lg font-extrabold tracking-[5px] text-[#f0e6c8]">マイページ</h1>
      <Link href="/my" aria-label="マイページ">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full border-2 border-[#d4b96a]/70 object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#d4b96a]/70 text-lg">
            🌊
          </span>
        )}
      </Link>
    </header>
  );
}
