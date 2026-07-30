"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Suggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status_line: string | null;
}

/** ✨ おすすめのむらびと（楽市楽座から移植・横スクロールカード） */
export function VillagerSuggestions() {
  const [profiles, setProfiles] = useState<Suggestion[]>([]);

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
      <p className="mb-1.5 px-1 text-xs font-medium text-[#8a8070]">✨ おすすめのむらびと</p>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {profiles.map((p) => (
          <Link
            key={p.id}
            href={`/u/${p.username}`}
            className="block w-32 flex-shrink-0 overflow-hidden rounded-xl border border-[#ede5d8] p-2.5 text-center no-underline"
            style={{ background: "linear-gradient(180deg,#fffaf0 0%,#fdf6e9 100%)" }}
          >
            <div className="flex justify-center">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatar_url}
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
              {p.status_line ?? `@${p.username}`}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
