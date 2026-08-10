"use client";

import { HanaIchimonme } from "@/components/HanaIchimonme";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";
import { createClient } from "@/lib/supabase/client";
import { Shop, Market, ZA_CATEGORIES, categoryOf, fetchShops } from "@/lib/za";
import { ZaFeatured } from "@/components/ZaFeatured";
import { VillagerSuggestions } from "@/components/VillagerSuggestions";
import { srcCdn } from "@/lib/images";
import { ZaLegendButton } from "@/components/ZaLegend";

function priceLabel(s: Shop): string {
  if (s.market === "ichi") return s.accepts_barter && !s.is_trial ? "ブツブツ交換" : "0円";
  if (s.price_jpy != null) return `¥${s.price_jpy.toLocaleString()}`;
  return "値段相談";
}

/** 楽座 — マーケット一覧（楽市楽座の楽座ページを移植） */
export default function ZaPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState(""); // キーワード検索
  const [market, setMarket] = useState<Market>("ichi");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [me, setMe] = useState<import("@supabase/supabase-js").User | null>(null);

  useEffect(() => {
    // 未ログインでも閲覧できる公開ページ（URLシェア用）。
    // ログイン中ならアイコンを出してマイページへ飛べるようにする
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMe(session?.user ?? null);
      setAvatar((session?.user?.user_metadata?.avatar_url as string) ?? null);
      const uid = session?.user?.id;
      if (uid) {
        supabase.from("profiles").select("avatar_url").eq("id", uid).maybeSingle().then(({ data }) => {
          if (data?.avatar_url) setAvatar(data.avatar_url);
        });
      }
    });
  }, []);

  useEffect(() => {
    setShops(null);
    fetchShops(category).then(setShops);
  }, [category]);

  // キーワード一致(商品名・説明・カテゴリ名。空なら全通し)
  const matchQ = (s: Shop) => {
    const k = q.trim().toLowerCase();
    if (!k) return true;
    return (
      (s.name ?? "").toLowerCase().includes(k) ||
      (s.description ?? "").toLowerCase().includes(k) ||
      (categoryOf(s.category)?.label ?? "").toLowerCase().includes(k)
    );
  };

  return (
    <main className="overflow-x-clip pb-20">
      <TopTone color="#ffffff" />
      {/* 旧楽市楽座のヒーロー: 鳥居エンブレム + 楽市楽座 + 日本人総フリーランス化計画（朱色で統一） */}
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-white/95 backdrop-blur-sm">
        <div className="flex h-[52px] items-center justify-between px-4">
          <span className="inline-flex select-none items-center" style={{ color: "#c94d3a", gap: 8 }}>
            <svg
              width={40}
              height={40}
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ flexShrink: 0 }}
            >
              <circle cx="50" cy="50" r="42" strokeWidth="4.5" />
              <line x1="50" y1="20" x2="50" y2="32" strokeWidth="2.6" />
              <ellipse cx="44" cy="20" rx="5.5" ry="3" fill="currentColor" stroke="none" transform="rotate(-30 44 20)" />
              <ellipse cx="56" cy="20" rx="5.5" ry="3" fill="currentColor" stroke="none" transform="rotate(30 56 20)" />
              <line x1="20" y1="38" x2="80" y2="38" strokeWidth="7" />
              <line x1="28" y1="50" x2="72" y2="50" strokeWidth="4" />
              <line x1="34" y1="38" x2="32" y2="80" strokeWidth="5.5" />
              <line x1="66" y1="38" x2="68" y2="80" strokeWidth="5.5" />
            </svg>
            <span className="whitespace-nowrap font-bold" style={{ fontSize: 22, letterSpacing: "0.06em", lineHeight: 1 }}>
              楽市楽座
            </span>
            <span
              className="whitespace-nowrap font-semibold"
              style={{ fontSize: 10, letterSpacing: "-0.02em", lineHeight: 1, marginLeft: 2, opacity: 0.85 }}
            >
              日本人総フリーランス化計画
            </span>
          </span>
          {/* 他ページと同じ: 未ログインでも丸「ゲスト」のAvatarMenu(中でログイン導線あり) */}
          <AvatarMenu ring="#c94d3a" />
        </div>
      </header>

      <div className="space-y-3 pt-3">
        {/* 本日のパワープッシュ楽座 */}
        {shops && shops.length > 0 && <ZaFeatured shops={shops} />}

        {/* おすすめのむらびと */}
        <VillagerSuggestions title="おすすめの座主" sellersOnly />

        {/* 楽市 / 楽座 の切り替え */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#ede5d8] bg-[#f5efe2] p-1">
          {(
            [
              ["ichi", "楽市", "０円かブツブツ交換"],
              ["za", "楽座", "有料でプロの商品"],
              ["hana", "この指とまれ", "花いちもんめ"],
            ] as const
          ).map(([id, label, sub]) => (
            <button
              key={id}
              onClick={() => setMarket(id as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
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

        {market === ("hana" as any) ? ( // eslint-disable-line @typescript-eslint/no-explicit-any
          <HanaIchimonme me={me} />
        ) : (
        <>
        {/* キーワード検索 */}
        <div className="relative mb-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="商品名・キーワードで探す（例: 味噌、Tシャツ、鍼灸）"
            className="w-full rounded-full border border-[#ede5d8] bg-white py-2 pl-9 pr-9 text-[13px] outline-none focus:border-[#c94d3a]"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="消す" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#f0ece2] text-[12px] font-bold text-[#8a8070]">×</button>
          )}
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
            className="mb-3 flex items-center gap-2.5 rounded-xl px-3 py-3 shadow-md"
            style={{ background: "linear-gradient(120deg,#c94d3a,#a03020)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rakuichi/logo-emblem.webp"
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold leading-tight text-white">
                楽市、楽座を出す
              </div>
              <div className="text-[10.5px] leading-tight text-white/85">
                お試し出品（0円）もブツブツ交換もOK
              </div>
            </div>
            <div className="flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold" style={{ color: "#c94d3a" }}>出品する →</div>
          </div>
        </Link>
        <ZaLegendButton />

        {/* 一覧（楽市/楽座でフィルタ） */}
        {shops === null ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : shops.filter((s) => s.market === market && matchQ(s)).length === 0 ? (
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {/* フリマは スマホ2列 → タブレット3列 → PC4列（Mercari等のPC版と同じ流儀） */}
            {shops.filter((s) => s.market === market && matchQ(s)).map((shop) => {
              const cat = categoryOf(shop.category);
              return (
                <Link key={shop.id} href={`/za/${shop.id}`} className="block no-underline">
                  <div
                    className="relative flex h-full flex-col overflow-hidden rounded-md border border-[#ede5d8] shadow-sm"
                    style={{ background: "linear-gradient(180deg,#fffaf0 0%,#fdf6e9 100%)" }}
                  >
                    <div className="absolute left-0 right-0 top-0 z-10 h-[3px]" style={{ background: "#c94d3a" }} />
                    <div className="relative aspect-square overflow-hidden bg-[#f2ede4]">
                      {shop.sold && (
                        <span
                          className="pointer-events-none absolute left-1/2 top-1/2 z-10 border-[3px] border-[#d02020] px-2 py-0.5 text-[15px] font-extrabold tracking-[2px] text-[#d02020]"
                          style={{ transform: "translate(-50%,-50%) rotate(-18deg)", background: "rgba(255,255,255,.6)", whiteSpace: "nowrap" }}
                        >
                          SOLD OUT
                        </span>
                      )}
                      {(shop.thumb_urls?.[0] ?? shop.image_urls[0]) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={srcCdn(shop.thumb_urls?.[0] ?? shop.image_urls[0])} alt={shop.name} className="h-full w-full object-cover" style={shop.sold ? { filter: "grayscale(1)" } : undefined} />
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

                      {shop.trial_ver && (
                        <div
                          className="absolute right-1.5 rounded-sm px-1.5 py-0.5 text-[9.5px] font-extrabold text-white"
                          style={{ background: "#c94d3a", top: shop.first_try ? 46 : 6 }}
                        >
                          【お試し版】
                        </div>
                      )}
                      {shop.first_try && (
                        <div className="absolute right-1.5 top-1.5 flex flex-col items-center">
                          <span className="text-[20px]" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.3))" }}>🔰</span>
                          <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#2a6a3a]">初心者応援！</span>
                        </div>
                      )}
                      {shop.profiles?.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={srcCdn(shop.profiles.avatar_url)}
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
                          {shop.accepts_barter && <span title="ブツブツ交換可"><img src="/icons/icon-barter.webp" alt="" style={{ width: 12, height: 12, display: "inline", verticalAlign: -2 }} /></span>}
                          {shop.accepts_tip && <span title="投げ銭可"><img src="/icons/icon-coin.webp" alt="" style={{ width: 12, height: 12, display: "inline", verticalAlign: -2 }} /></span>}
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
        </>
        )}
      </div>
    </main>
  );
}
