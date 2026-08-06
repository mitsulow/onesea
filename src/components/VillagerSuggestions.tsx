"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeishiModal } from "./MeishiModal";
import { srcCdn } from "@/lib/images";

interface Suggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status_line: string | null;
}

/** ✨ おすすめの人（横スクロール）。タップでまず名刺→マイページへ。
 * sellersOnly: 実際に出品がある人（座主）だけに絞る — 登録しただけの
 * 無料会員が「おすすめの座主」に並ばないように */
export function VillagerSuggestions({
  title = "✨ おすすめのむらびと",
  sellersOnly = false,
  variant = "row",
}: {
  title?: string;
  sellersOnly?: boolean;
  variant?: "row" | "list"; // list=縦並び（PCの右レール用・マウスで確実にクリックできる）
}) {
  const [profiles, setProfiles] = useState<Suggestion[]>([]);
  const [meishi, setMeishi] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      let q = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, status_line")
        .not("username", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (sellersOnly) {
        const { data: shops } = await supabase
          .from("shops")
          .select("owner_id")
          .order("created_at", { ascending: false })
          .limit(60);
        const ids = [...new Set((shops ?? []).map((s) => s.owner_id))].slice(0, 10);
        if (ids.length === 0) {
          setProfiles([]);
          return;
        }
        q = supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, status_line")
          .not("username", "is", null)
          .in("id", ids)
          .limit(10);
      }
      const { data } = await q;
      setProfiles((data as Suggestion[]) ?? []);
    })();
  }, [sellersOnly]);

  if (profiles.length === 0) return null;

  // 縦並び（PCの右レール）: マウスで確実に押せる素直なリスト
  if (variant === "list") {
    return (
      <div>
        {meishi && <MeishiModal username={meishi} onClose={() => setMeishi(null)} />}
        <p className="mb-1.5 px-1 text-xs font-bold text-[#65676b]">{title}</p>
        <div className="space-y-0.5">
          {profiles.slice(0, 6).map((p) => (
            <button
              key={p.id}
              onClick={() => setMeishi(p.username)}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-[#f2f3f5]"
            >
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={srcCdn(p.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[15px]" style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}>🌿</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-[#1c1e21]">{p.display_name ?? "むらびと"}</span>
                <span className="block truncate text-[10.5px] text-[#a09888]">{p.status_line ?? "よろしくね 🌿"}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {meishi && <MeishiModal username={meishi} onClose={() => setMeishi(null)} />}
      <p className="mb-1.5 px-1 text-xs font-medium text-[#8a8070]">{title}</p>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setMeishi(p.username)}
            className="block w-32 flex-shrink-0 overflow-hidden rounded-xl border border-[#ede5d8] p-2.5 text-center"
            style={{ background: "linear-gradient(180deg,#fffaf0 0%,#fdf6e9 100%)" }}
          >
            <div className="flex justify-center">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={srcCdn(p.avatar_url)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                  style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                >
                  🌿
                </div>
              )}
            </div>
            <div className="mt-1.5 truncate text-xs font-bold text-[#3a3428]">
              {p.display_name ?? "むらびと"}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[#a09888]">
              {p.status_line ?? "よろしくね 🌿"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
