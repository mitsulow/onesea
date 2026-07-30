"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** マイページのヘッダー。アバターとログアウトだけの控えめな帯 */
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

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const meta = user?.user_metadata ?? {};
  const avatar = (meta.avatar_url as string) ?? null;
  const name = (meta.full_name as string) ?? (meta.name as string) ?? "";

  return (
    <header
      className="flex items-center justify-between px-5 pb-3.5 pt-4 text-[#e8f0f6]"
      style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
    >
      <h1 className="text-lg font-extrabold tracking-[4px] text-[#f0e6c8]">マイページ</h1>
      <div className="flex items-center gap-2.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border border-[#d4b96a]/60 object-cover"
          />
        ) : (
          <span className="text-lg">🌊</span>
        )}
        <button
          onClick={logout}
          className="rounded-lg border border-[#3e6a88] px-2.5 py-1 text-[10.5px] font-bold text-[#9ab8cc]"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
