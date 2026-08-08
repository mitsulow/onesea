"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Shop, ShopComment, categoryOf, fetchShop, deleteShop, fetchShopComments, addShopComment, deleteShopComment, fetchShopsByOwner } from "@/lib/za";
import { getOrCreateChat, sendMessage } from "@/lib/line";
import { srcCdn } from "@/lib/images";

/** 楽座の詳細 — 「連絡を取る」で出品者と LINE が始まる */
export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [me, setMe] = useState<User | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [contacting, setContacting] = useState(false);
  const [comments, setComments] = useState<ShopComment[]>([]);
  const [cBody, setCBody] = useState("");
  const [cSending, setCSending] = useState(false);
  /* ブツブツ交換の提案 */
  const [barterOpen, setBarterOpen] = useState(false);
  const [myShops, setMyShops] = useState<Shop[] | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [offerText, setOfferText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [offers, setOffers] = useState<any[]>([]); // みんなのブツブツ交換提案（公開）

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    fetchShop(params.id).then((s) => setShop(s));
    fetchShopComments(params.id).then(setComments);
    loadOffers();
  }, [params.id]);

  const loadOffers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("barter_offers")
      .select("id, user_id, offer, offer_shop_id, created_at, profiles!barter_offers_user_id_fkey(username, display_name, avatar_url)")
      .eq("shop_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) { setOffers(data); return; }
    const { data: d2 } = await supabase
      .from("barter_offers")
      .select("id, user_id, offer, offer_shop_id, created_at")
      .eq("shop_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setOffers(d2 ?? []);
  };

  const openBarter = async () => {
    setBarterOpen(true);
    if (me && myShops === null) {
      const mine = await fetchShopsByOwner(me.id);
      setMyShops(mine.filter((s) => s.id !== params.id));
    }
  };

  const propose = async () => {
    if (!me || !shop || proposing) return;
    const offerShop = myShops?.find((s) => s.id === offerId) ?? null;
    const offer = offerShop ? offerShop.name : offerText.trim();
    if (!offer) return;
    setProposing(true);
    const chatId = await getOrCreateChat(me.id, shop.owner_id);
    if (chatId) {
      const lines = [
        "ブツブツ交換の提案",
        `「${shop.name}」⇄「${offer}」`,
      ];
      if (offerShop) lines.push(`こちらです → https://onesea.vercel.app/za/${offerShop.id}`);
      lines.push("いかがでしょうか？");
      await sendMessage(chatId, me.id, lines.join("\n"));
      // みんなにも見えるように公開一覧へ
      const supabase = createClient();
      await supabase.from("barter_offers").insert({ shop_id: params.id, user_id: me.id, offer, offer_shop_id: offerShop?.id ?? null });
      loadOffers();
      setBarterOpen(false);
      setOfferText("");
      setOfferId(null);
      alert("ブツブツ交換を提案しました！出品者にTalKでお知らせが届きます。下の「いま来ている提案」にあなたのカードが並びました");
    }
    setProposing(false);
  };

  const sendComment = async () => {
    if (!me || !cBody.trim() || cSending) return;
    setCSending(true);
    await addShopComment(params.id, me.id, cBody.trim());
    setCBody("");
    setCSending(false);
    setComments(await fetchShopComments(params.id));
  };

  const contact = async () => {
    if (!me || !shop || contacting) return;
    setContacting(true);
    const chatId = await getOrCreateChat(me.id, shop.owner_id);
    setContacting(false);
    if (chatId) router.push(`/talk/${chatId}`);
  };

  const [amOffice, setAmOffice] = useState(false); // 事務局は出品を削除できる
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmOffice)).catch(() => {});
  }, [me]);

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

      {/* 画像（左右スワイプで切替・スクロールスナップ） */}
      <div className="relative">
        <div
          className="hide-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto bg-[#f2ede4]"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== imgIndex) setImgIndex(i);
          }}
        >
          {(shop.image_urls.length ? shop.image_urls : [null]).map((url, i) =>
            url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={srcCdn(url)} alt={shop.name} className="h-full w-full flex-shrink-0 snap-center object-cover" style={shop.sold ? { filter: "grayscale(1)" } : undefined} />
            ) : (
              <div
                key={i}
                className="flex h-full w-full flex-shrink-0 snap-center items-center justify-center"
                style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 50%,#5a7d4a 100%)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/rakuichi/logo-emblem.webp" alt="" className="h-24 w-24 rounded-full object-cover opacity-90" />
              </div>
            )
          )}
        </div>
        {shop.sold && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span
              className="border-[6px] border-[#d02020] px-6 py-1 text-[64px] font-extrabold tracking-[6px] text-[#d02020]"
              style={{ transform: "rotate(-18deg)", textShadow: "0 2px 8px rgba(0,0,0,.3)", background: "rgba(255,255,255,.55)" }}
            >
              SOLD
            </span>
          </div>
        )}
        {shop.image_urls.length > 1 && (
          <>
            <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {shop.image_urls.map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ background: i === imgIndex ? "#c94d3a" : "rgba(255,255,255,.75)" }}
                />
              ))}
            </div>
            <span className="num absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-bold text-white">
              {imgIndex + 1}/{shop.image_urls.length}
            </span>
          </>
        )}
      </div>

      <div className="space-y-3.5 px-2 pt-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-[2px] text-white"
              style={{ background: shop.market === "ichi" ? "#5a7d4a" : "#c94d3a" }}
            >
              {shop.market === "ichi" ? "楽市" : "楽座"}
            </span>
            <h1 className="min-w-0 text-xl font-extrabold leading-snug text-[#3a3428]">{shop.name}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="text-xl font-extrabold" style={{ color: "#c94d3a" }}>
              {shop.market === "ichi"
                ? shop.is_trial
                  ? "0円（ゆずります）"
                  : "ブツブツ交換で"
                : shop.price_jpy != null
                  ? `¥${shop.price_jpy.toLocaleString()}`
                  : "値段相談"}
            </span>
            <span className="flex gap-1 text-[13px] text-[#8a8070]">
              {shop.accepts_barter && <span><img src="/icons/icon-barter.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> ブツブツ交換OK</span>}
              {shop.handover && (
                <span style={{ color: "#5a7d4a", fontWeight: 700 }}>
                  {shop.handover === "pickup" ? "🚶 取りに来てくれる人優先" : shop.handover === "cod" ? "📦 着払いでの郵送可" : "🚶📦 取りに来ても着払い郵送もOK"}
                </span>
              )}
              {shop.accepts_tip && <span><img src="/icons/icon-coin.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> 投げ銭OK</span>}
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
              <img src={srcCdn(owner.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
              >
                <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[#3a3428]">{owner.display_name ?? "むらびと"}</div>
              <div className="text-[11px] text-[#a09888]">出品者の名刺を見る →</div>
            </div>
          </Link>
        )}

        {!isMine && amOffice && (
          <button
            onClick={async () => {
              if (!shop || !confirm("【事務局権限】この出品を削除しますか？（法令違反等）")) return;
              const { createClient } = await import("@/lib/supabase/client");
              await createClient().from("shops").delete().eq("id", shop.id);
              router.replace("/za");
            }}
            className="mb-2 w-full rounded-xl border border-[#c05030] bg-white py-3 text-[13.5px] font-bold text-[#c05030]"
          >
            事務局権限でこの出品を削除する
          </button>
        )}
        {isMine ? (
          <button
            onClick={remove}
            className="w-full rounded-xl border border-[#e0d6c6] bg-white py-3 text-[13.5px] font-bold text-[#a09888]"
          >
            この楽座を取り下げる
          </button>
        ) : me ? (
          <div className="space-y-2">
            {shop.accepts_barter && (
              <button
                onClick={openBarter}
                className="w-full rounded-xl border-2 py-3 text-[14px] font-extrabold"
                style={{ borderColor: "#5a7d4a", color: "#5a7d4a", background: "#f4f8f0" }}
              >
                <img src="/icons/icon-barter.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> ブツブツ交換を提案する
              </button>
            )}
            {offers.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] font-extrabold text-[#5a7d4a]">
                  いま来ているブツブツ交換の提案（{offers.length}件）
                </div>
                <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {offers.map((o: any) => (
                    <div key={o.id} className="relative w-[150px] flex-shrink-0 rounded-xl border border-[#d8e4d0] bg-[#f7faf4] p-2.5">
                      <div className="flex items-center gap-1.5">
                        {o.profiles?.avatar_url ? (
                          <img src={o.profiles.avatar_url} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dce8d4] text-[10px]">?</span>
                        )}
                        <span className="truncate text-[10.5px] font-bold text-[#5a7d4a]">{o.profiles?.display_name ?? "むらびと"}</span>
                      </div>
                      <div className="mt-1.5 line-clamp-3 text-[12px] font-bold leading-snug text-[#3a3428]">⇄ {o.offer}</div>
                      {o.offer_shop_id && (
                        <a href={`/za/${o.offer_shop_id}`} className="mt-1 block text-[10px] font-bold text-[#3070b0] underline">出品を見る →</a>
                      )}
                      {o.accepted && (
                        <span
                          className="pointer-events-none absolute right-1 top-1 flex h-[46px] w-[46px] items-center justify-center rounded-full border-[3px] border-[#d02020] text-[13px] font-extrabold text-[#d02020]"
                          style={{ transform: "rotate(-14deg)", background: "rgba(255,255,255,.82)" }}
                        >
                          決定
                        </span>
                      )}
                      {me && shop.owner_id === me.id && !shop.sold && (
                        <button
                          onClick={async () => {
                            if (!confirm(`「${o.profiles?.display_name ?? "この人"}さん」とのブツブツ交換に決定しますか？\n（商品はSOLDになります）`)) return;
                            const supabase = createClient();
                            await supabase.from("barter_offers").update({ accepted: true }).eq("id", o.id);
                            await supabase.from("shops").update({ sold: true }).eq("id", shop.id).eq("owner_id", me.id);
                            // 決定した相手にTalKでお知らせ
                            try {
                              const chatId = await getOrCreateChat(me.id, o.user_id);
                              if (chatId) await sendMessage(chatId, me.id, `【ブツブツ交換 成立】「${shop.name}」⇄「${o.offer}」で決定しました！やり取りの続きはこのTalKで🤝`);
                            } catch {}
                            fetchShop(params.id).then((s2) => setShop(s2));
                            loadOffers();
                          }}
                          className="mt-1.5 w-full rounded-lg bg-[#c94d3a] py-1.5 text-[10.5px] font-extrabold text-white"
                        >
                          この人に決めた
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {shop.market === "za" && (
              <p className="rounded-xl bg-[#fdf6e4] px-3 py-2 text-center text-[11px] leading-relaxed text-[#8a7020]" style={{ border: "1px solid #e8d8a8" }}>
                商品が売れた場合の発送料や金銭の授受は、個人同士でやり取りしてください
              </p>
            )}
            <button
              onClick={contact}
              disabled={contacting}
              className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#c94d3a" }}
            >
              {contacting ? "ひらいています..." : " 連絡を取る（TALKで商談）"}
            </button>
          </div>
        ) : (
          <p className="text-center text-[12px] text-[#a09888]">ログインすると連絡できます</p>
        )}

        {/* コメント / シェア / 通報 の3ボタン */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            onClick={() => document.getElementById("shop-comments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-xl border border-[#e0d6c6] bg-white py-2 text-[11px] font-bold text-[#5a5448]"
          >
            <img src="/icons/icon-chat.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> コメントする
          </button>
          <button
            onClick={() => {
              const url = `https://onesea.vercel.app/za/${params.id}`;
              if (navigator.share) navigator.share({ text: shop?.name ?? "", url }).catch(() => {});
              else { navigator.clipboard?.writeText(url); alert("リンクをコピーしました"); }
            }}
            className="rounded-xl border border-[#e0d6c6] bg-white py-2 text-[11px] font-bold text-[#5a5448]"
          >
            <img src="/icons/icon-share2.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> シェアする
          </button>
          <button
            onClick={async () => {
              if (!me) { alert("通報にはログインが必要です"); return; }
              const reason = prompt("この商品を事務局に通報します。理由を教えてください");
              if (reason === null) return;
              const supabase = createClient();
              await supabase.from("post_reports").insert({ kind: "za", target_id: params.id, target_url: `/za/${params.id}`, excerpt: (shop?.name ?? "").slice(0, 120), reporter: me.id, reason: reason || null });
              alert("事務局に通報しました");
            }}
            className="rounded-xl border border-[#e8c4b8] bg-white py-2 text-[11px] font-bold text-[#c05030]"
          >
            ⚑ 通報する
          </button>
        </div>

        {/* ブツブツ交換の提案ダイアログ */}
        {barterOpen && shop && (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center px-5"
            style={{ background: "rgba(20,16,10,0.5)", backdropFilter: "blur(3px)" }}
            onClick={() => setBarterOpen(false)}
          >
            <div
              className="relative max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-[#fffdf8] p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setBarterOpen(false)}
                aria-label="閉じる"
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#f0ebe0] text-[13px] font-bold text-[#a09888]"
              >
                ✕
              </button>
              <div className="text-center text-[15px] font-extrabold text-[#5a7d4a]"><img src="/icons/icon-barter.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} /> ブツブツ交換を提案</div>
              <div className="mt-0.5 text-center text-[11px] text-[#8a8070]">
                「{shop.name}」と何を交換しますか？
              </div>

              {/* 自分の出品から選ぶ */}
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-bold text-[#8a7a5a]">あなたの出品から選ぶ</div>
                {myShops === null ? (
                  <p className="py-2 text-[12px] text-[#b0a898]">読み込み中...</p>
                ) : myShops.length === 0 ? (
                  <p className="py-1 text-[12px] text-[#b0a898]">まだ出品がありません（下の自由入力でどうぞ）</p>
                ) : (
                  <div className="space-y-1.5">
                    {myShops.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setOfferId(offerId === s.id ? null : s.id);
                          setOfferText("");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left"
                        style={
                          offerId === s.id
                            ? { borderColor: "#5a7d4a", background: "#f0f6ec" }
                            : { borderColor: "#ede5d8", background: "#fff" }
                        }
                      >
                        {s.image_urls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={srcCdn(s.image_urls[0])} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#f2ede4] text-[16px]">
                            <img src="/icons/icon-gift.webp" alt="" style={{ width: 20, height: 20, display: "inline", verticalAlign: -4 }} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#3a3428]">{s.name}</span>
                        {offerId === s.id && <span className="flex-shrink-0 text-[14px] text-[#5a7d4a]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 自由入力 */}
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-bold text-[#8a7a5a]">出品していない物で提案する</div>
                <input
                  value={offerText}
                  onChange={(e) => {
                    setOfferText(e.target.value);
                    if (e.target.value) setOfferId(null);
                  }}
                  placeholder="例: 手作り味噌1kg / 畑の野菜 / 3時間の手伝い"
                  className="w-full rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[#5a7d4a]"
                />
              </div>

              <button
                onClick={propose}
                disabled={proposing || (!offerId && !offerText.trim())}
                className="mt-3.5 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#5a7d4a" }}
              >
                {proposing ? "提案しています..." : "この内容で提案する"}
              </button>
              <p className="mt-1.5 text-center text-[9.5px] text-[#b8ae9c]">
                相手のTALKに提案が届き、そのままトークで交渉できます
              </p>
            </div>
          </div>
        )}

        {/* コメント欄（ツッコミ歓迎） */}
        <div id="shop-comments" className="rounded-xl border border-[#ede5d8] bg-white p-3">
          <div className="mb-2 text-[12px] font-extrabold tracking-wider text-[#8a7a5a]">
            <img src="/icons/icon-chat.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> コメント{comments.length > 0 ? `（${comments.length}）` : ""}
          </div>
          {comments.length === 0 ? (
            <p className="pb-1 text-[12px] text-[#b0a898]">まだコメントがありません。ひとこと目をどうぞ</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  {c.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={srcCdn(c.profiles.avatar_url)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f2ede4] text-[12px]">
                      <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11.5px] font-bold text-[#3a3428]">
                        {c.profiles?.display_name ?? "むらびと"}
                      </span>
                      <span className="num flex-shrink-0 text-[9.5px] text-[#c0b8a8]">
                        {new Date(c.created_at).getMonth() + 1}/{new Date(c.created_at).getDate()}
                      </span>
                    </div>
                    <p className="break-words text-[13px] leading-relaxed text-[#4a4438]">{c.body}</p>
                    {me?.id === c.user_id && (
                      <button
                        onClick={async () => {
                          await deleteShopComment(c.id, me.id);
                          setComments(await fetchShopComments(params.id));
                        }}
                        className="text-[10px] text-[#c0b8a8] underline"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {me ? (
            <div className="mt-2.5 flex items-end gap-2">
              <textarea
                value={cBody}
                onChange={(e) => setCBody(e.target.value)}
                rows={1}
                maxLength={300}
                placeholder="ツッコミも歓迎"
                className="min-h-[38px] flex-1 resize-y rounded-xl border border-[#ede5d8] bg-[#fdfbf6] px-3 py-2 text-[13px] outline-none focus:border-[#c94d3a]"
              />
              <button
                onClick={sendComment}
                disabled={!cBody.trim() || cSending}
                className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#c94d3a" }}
              >
                送る
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[#b0a898]">ログインするとコメントできます</p>
          )}
        </div>
      </div>
    </main>
  );
}
