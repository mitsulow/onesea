"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Shop, categoryOf, fetchShop, deleteShop } from "@/lib/za";
import { getOrCreateChat } from "@/lib/line";

/** 楽座の詳細 — 「連絡を取る」で出品者と LINE が始まる */
export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [me, setMe] = useState<User | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    fetchShop(params.id).then((s) => setShop(s));
  }, [params.id]);

  const contact = async () => {
    if (!me || !shop || contacting) return;
    setContacting(true);
    const chatId = await getOrCreateChat(me.id, shop.owner_id);
    setContacting(false);
    if (chatId) router.push(`/line/${chatId}`);
  };

  const remove = async () => {
    if (!me || !shop) return;
    if (!confirm("この楽座を取り下げますか？")) return;
    await deleteShop(shop.id, me.id);
    router.replace("/za");
  };

  if (shop === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
      </div>
    );
  }
  if (shop === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-[#8a8070]">この楽座は見つかりませんでした</p>
        <Link href="/za" className="mt-4 inline-block text-sm text-[#c94d3a] underline">
          楽座へもどる
        </Link>
      </div>
    );
  }

  const cat = categoryOf(shop.category);
  const isMine = me?.id === shop.owner_id;
  const owner = shop.profiles;

  return (
    <main className="pb-24">
      <header
        className="flex items-center justify-between px-4 pb-3.5 pt-4"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/za" className="text-[13px] font-bold text-[#d4b96a] no-underline">
          ◀ 楽座
        </Link>
        <span className="text-[11px] tracking-widest text-[#7a9ab4]">
          {cat ? `${cat.emoji} ${cat.label}` : "楽座"}
        </span>
        <span className="w-10" />
      </header>

      {/* 画像 */}
      <div className="relative aspect-square bg-[#f2ede4]">
        {shop.image_urls[imgIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.image_urls[imgIndex]} alt={shop.name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 50%,#5a7d4a 100%)" }}
          >
            <img src="/rakuichi/logo-emblem.webp" alt="" className="h-24 w-24 rounded-full object-cover opacity-90" />
          </div>
        )}
        {shop.image_urls.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {shop.image_urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                aria-label={`画像 ${i + 1}`}
                className="h-2 w-2 rounded-full"
                style={{ background: i === imgIndex ? "#c94d3a" : "rgba(255,255,255,.7)" }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3.5 px-4 pt-4">
        <div>
          <h1 className="text-xl font-extrabold leading-snug text-[#3a3428]">{shop.name}</h1>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="text-xl font-extrabold" style={{ color: "#c94d3a" }}>
              {shop.is_trial ? "0円〜（お試し）" : shop.price_jpy != null ? `¥${shop.price_jpy.toLocaleString()}` : "応相談"}
            </span>
            <span className="flex gap-1 text-[13px] text-[#8a8070]">
              {shop.accepts_barter && <span>🔄 物々交換OK</span>}
              {shop.accepts_tip && <span>🪙 投げ銭OK</span>}
            </span>
          </div>
        </div>

        {shop.description && (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#5a5448]">{shop.description}</p>
        )}

        {/* 出品者 */}
        {owner && (
          <Link
            href={owner.username ? `/u/${owner.username}` : "#"}
            className="flex items-center gap-3 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5 no-underline"
          >
            {owner.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={owner.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
              >
                🌿
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[#3a3428]">{owner.display_name ?? "むらびと"}</div>
              <div className="text-[11px] text-[#a09888]">出品者の名刺を見る →</div>
            </div>
          </Link>
        )}

        {isMine ? (
          <button
            onClick={remove}
            className="w-full rounded-xl border border-[#e0d6c6] bg-white py-3 text-[13.5px] font-bold text-[#a09888]"
          >
            この楽座を取り下げる
          </button>
        ) : me ? (
          <button
            onClick={contact}
            disabled={contacting}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {contacting ? "ひらいています..." : "💬 連絡を取る（LINEで商談）"}
          </button>
        ) : (
          <p className="text-center text-[12px] text-[#a09888]">ログインすると連絡できます</p>
        )}
      </div>
    </main>
  );
}
