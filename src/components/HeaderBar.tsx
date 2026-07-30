"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** ヒーロー: 中央に小さく「マイページ」、右のアイコンでメニュー（マイページ/手帳/ログアウト） */
export function HeaderBar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    window.location.href = "/";
  };

  const meta = user?.user_metadata ?? {};
  const avatar = (meta.avatar_url as string) ?? null;

  return (
    <header
      className="relative z-[60] flex items-center justify-center px-5 py-2"
      style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
    >
      <h1 className="text-[12px] font-bold tracking-[4px] text-[#f0e6c8]">マイページ</h1>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="メニュー"
        className="absolute right-4 top-1/2 -translate-y-1/2"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border-2 border-[#d4b96a]/70 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#d4b96a]/70 text-base">
            🌊
          </span>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-3 top-full z-[80] mt-1.5 w-44 overflow-hidden rounded-xl border border-[#ede5d8] bg-white"
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
          >
            <Link
              href="/my"
              onClick={() => setMenuOpen(false)}
              className="block border-b border-[#f2ece0] px-4 py-3 text-[14px] font-medium text-[#3a3428] no-underline active:bg-[#faf4ea]"
            >
              🪪 マイページ
            </Link>
            <Link
              href="/#techo"
              onClick={() => setMenuOpen(false)}
              className="block border-b border-[#f2ece0] px-4 py-3 text-[14px] font-medium text-[#3a3428] no-underline active:bg-[#faf4ea]"
            >
              📖 手帳
            </Link>
            <button
              onClick={logout}
              className="block w-full px-4 py-3 text-left text-[14px] font-medium text-[#a05040] active:bg-[#faf4ea]"
            >
              ログアウト
            </button>
          </div>
        </>
      )}
    </header>
  );
}
