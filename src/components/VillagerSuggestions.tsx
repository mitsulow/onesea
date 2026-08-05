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

/** ✨ おすすめの人（横スクロール）。タップでまず名刺→マイページへ */
export function VillagerSuggestions({ title = "✨ おすすめのむらびと" }: { title?: string }) {
  const [profiles, setProfiles] = useState<Suggestion[]>([]);
  const [meishi, setMeishi] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, status_line")
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setProfiles((data as Suggestion[]) ?? []));
  }, []);

  if (profiles.length === 0) return null;

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
