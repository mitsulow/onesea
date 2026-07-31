"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Shop, Market, ZA_CATEGORIES, categoryOf, fetchShops } from "@/lib/za";
import { ZaFeatured } from "@/components/ZaFeatured";
import { VillagerSuggestions } from "@/components/VillagerSuggestions";

function priceLabel(s: Shop): string {
  if (s.market === "ichi") return s.accepts_barter && !s.is_trial ? "物々交換" : "0円";
  if (s.price_jpy != null) return `¥${s.price_jpy.toLocaleString()}`;
  return "応相談";
}

/** 楽座 — マーケット一覧（楽市楽座の楽座ページを移植） */
export default function ZaPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [market, setMarket] = useState<Market>("ichi");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // 未ログインでも閲覧できる公開ページ（URLシェア用）。
    // ログイン中ならアイコンを出してマイページへ飛べるようにする
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
      setAvatar((session?.user?.user_metadata?.avatar_url as string) ?? null);
    });
  }, []);

  useEffect(() => {
    setShops(null);
    fetchShops(category).then(setShops);
  }, [category]);

  return (
    <main className="pb-20">
      <header className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rakuichi/logo-edo.webp" alt="楽市楽座" className="h-[92px] w-full object-cover" />
        {loggedIn ? (
          <Link href="/my" aria-label="マイページ" className="absolute right-3 top-2.5">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border-2 border-white/80 object-cover shadow"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/80 bg-black/20 text-base shadow">
                🌊
              </span>
            )}
          </Link>
        ) : (
          <Link
            href="/"
            className="absolute right-3 top-2.5 rounded-full bg-black/30 px-3 py-1.5 text-[11px] font-bold text-white no-underline"
          >
            ログイン
          </Link>
        )}
        <div className="absolute bottom-1.5 right-3 flex flex-col items-end gap-1">
          <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white">
            日本人総フリーランス化計画
          </span>
          <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white">
            やりたいことを仕事に
          </span>
        </div>
      </header>

      <div className="space-y-3 pt-3">
        {/* 本日のパワープッシュ楽座 */}
        {shops && shops.length > 0 && <ZaFeatured shops={shops} />}

        {/* おすすめのむらびと */}
        <VillagerSuggestions />

        {/* 楽市 / 楽座 の切り替え */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#ede5d8] bg-[#f5efe2] p-1">
          {(
            [
              ["ichi", "楽市", "0円・物々交換"],
              ["za", "楽座", "有料・プロの商品"],
            ] as const
          ).map(([id, label, sub]) => (
            <button
              key={id}
              onClick={() => setMarket(id)}
              className="rounded-xl py-2 text-center transition-colors"
              style={
                market === id
                  ? { background: "#c94d3a", color: "#fff", boxShadow: "0 2px 8px rgba(201,77,58,.35)" }
                  : { background: "transparent", color: "#8a8070" }
              }
            >
              <div className="text-[15px] font-extrabold leading-tight tracking-[3px]">{label}</div>
              <div className="text-[9px] leading-tight opacity-85">{sub}</div>
            </button>
          ))}
        </div>

        {/* カテゴリチップ */}
        <div className="hide-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
          <button
            onClick={() => setCategory(null)}
            className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={
              category === null
                ? { background: "#c94d3a", color: "#fff", borderColor: "#c94d3a" }
                : { background: "#fffdf8", color: "#5a5448", borderColor: "#ede5d8" }
            }
          >
            全部
          </button>
          {ZA_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={
                category === c.id
                  ? { background: "#c94d3a", color: "#fff", borderColor: "#c94d3a" }
                  : { background: "#fffdf8", color: "#5a5448", borderColor: "#ede5d8" }
              }
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* 出品CTA */}
        <Link href="/za/new" className="block no-underline">
          <div
            className="mb-3 flex items-center gap-2.5 rounded-xl border border-[#c94d3a66] px-3 py-2.5"
            style={{ background: "linear-gradient(135deg,#f5e8d5 0%,#ffffff 50%,#f5e8d5 100%)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rakuichi/logo-emblem.webp"
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight text-[#3a3428]">
                あなたも楽座を出しましょう
              </div>
              <div className="text-[10px] leading-tight text-[#8a8070]">
                お試し出品（0円）も物々交換もOK
              </div>
            </div>
            <div className="flex-shrink-0 text-base text-[#c94d3a]">→</div>
          </div>
        </Link>

        {/* 一覧（楽市/楽座でフィルタ） */}
        {shops === null ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : shops.filter((s) => s.market === market).length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed px-6 py-10 text-center"
            style={{ borderColor: "#c94d3a40", background: "linear-gradient(135deg,#fdf6e9,#f5e8d5)" }}
          >
            <img src="/rakuichi/logo-emblem.webp" alt="" className="mx-auto h-14 w-14 rounded-full object-cover" />
            <p className="mt-2 text-sm font-bold" style={{ color: "#c94d3a" }}>
              まだ{market === "ichi" ? "楽市" : "楽座"}がありません
            </p>
            <p className="mt-1 text-xs text-[#8a8070]">最初のひとつを出して、市場を始めよう</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shops.filter((s) => s.market === market).map((shop) => {
              const cat = categoryOf(shop.category);
              return (
                <Link key={shop.id} href={`/za/${shop.id}`} className="block no-underline">
                  <div
                    className="relative flex h-full flex-col overflow-hidden rounded-md border border-[#ede5d8] shadow-sm"
                    style={{ background: "linear-gradient(180deg,#fffaf0 0%,#fdf6e9 100%)" }}
                  >
                    <div className="absolute left-0 right-0 top-0 z-10 h-[3px]" style={{ background: "#c94d3a" }} />
                    <div className="relative aspect-square overflow-hidden bg-[#f2ede4]">
                      {shop.image_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.image_urls[0]} alt={shop.name} className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 50%,#5a7d4a 100%)" }}
                        >
                          <img src="/rakuichi/logo-emblem.webp" alt="" className="h-14 w-14 rounded-full object-cover opacity-90" />
                        </div>
                      )}
                      {cat && (
                        <div className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold">
                          {cat.emoji} {cat.label}
                        </div>
                      )}
                      {shop.is_trial && (
                        <div
                          className="absolute right-1.5 top-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold text-white"
                          style={{ background: "#c94d3a" }}
                        >
                          お試し
                        </div>
                      )}
                      {shop.profiles?.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shop.profiles.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute bottom-1 left-1 h-7 w-7 rounded-full object-cover ring-2 ring-white"
                        />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <h3 className="line-clamp-1 text-[12px] font-bold leading-tight text-[#3a3428]">
                        {shop.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="truncate text-[11px] font-bold" style={{ color: "#c94d3a" }}>
                          {priceLabel(shop)}
                        </span>
                        <span className="flex flex-shrink-0 gap-0.5 text-[10px] text-[#b0a898]">
                          {shop.accepts_barter && <span title="物々交換可">🔄</span>}
                          {shop.accepts_tip && <span title="投げ銭可">🪙</span>}
                        </span>
                        {(shop.shop_comments?.[0]?.count ?? 0) > 0 && (
                          <span className="num ml-auto flex-shrink-0 text-[10px] font-bold text-[#8a8070]">
                            💬{shop.shop_comments![0].count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
