"use client";

import { hasConsent } from "@/lib/consents";
import { ConsentDialog } from "@/components/ConsentDialog";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";
import { Market, ZA_CATEGORIES, uploadShopImage } from "@/lib/za";
import { CameraIcon } from "@/components/CameraIcon";
import { UpgradeDialog } from "@/components/UpgradeGate";
import { fetchIsWarawa } from "@/lib/warawa";

/** 楽座を出す（出品フォーム） */
export default function NewShopPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [market, setMarket] = useState<Market>("ichi");
  const [price, setPrice] = useState("");
  const [payUrl, setPayUrl] = useState(""); // BASE・PayPayなど外部決済のURL(楽座)
  const [isTrial, setIsTrial] = useState(true);
  const [barter, setBarter] = useState(false);
  const [handover, setHandover] = useState("both"); // 交換方法(楽市のみ)
  const [tip, setTip] = useState(false);
  const [category, setCategory] = useState<string>("other");

  const [images, setImages] = useState<Array<{ full: string; thumb: string }>>([]);

  /* 下書き保持: 入力のたびに保存し、再読込されても復元(出品完了で消す) */
  const DRAFT_KEY = "onesea-za-draft";
  const restoredRef = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { restoredRef.current = true; return; }
      const d = JSON.parse(raw);
      if (d.market) setMarket(d.market);
      if (d.name) setName(d.name);
      if (d.description) setDescription(d.description);
      if (d.price) setPrice(d.price);
      if (d.payUrl) setPayUrl(d.payUrl);
      if (typeof d.isTrial === "boolean") setIsTrial(d.isTrial);
      if (typeof d.barter === "boolean") setBarter(d.barter);
      if (typeof d.tip === "boolean") setTip(d.tip);
      if (d.handover) setHandover(d.handover);
      if (d.category) setCategory(d.category);
      if (Array.isArray(d.images)) setImages(d.images);
    } catch {}
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ market, name, description, price, payUrl, isTrial, barter, tip, handover, category, images }));
    } catch {}
  }, [market, name, description, price, payUrl, isTrial, barter, tip, handover, category, images]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gateReady, setGateReady] = useState(false); // 出品はわらわ〜会員専用
  const [isWara, setIsWara] = useState(false);
  const [consentDlg, setConsentDlg] = useState(false); // 初出店前の法令遵守の同意

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setIsWara(await fetchIsWarawa(u?.id));
      setGateReady(true);
    });
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!me || !files || uploading) return;
    setUploading(true);
    const pairs: Array<{ full: string; thumb: string }> = [];
    for (const f of Array.from(files).slice(0, 4 - images.length)) {
      const pair = await uploadShopImage(me.id, f);
      if (pair) pairs.push(pair);
    }
    setImages((prev) => [...prev, ...pairs].slice(0, 4));
    setUploading(false);
  };

  const submit = async () => {
    if (!me || !name.trim() || saving) return;
    // 初出店だけ: 法令遵守の同意を取る
    if (!(await hasConsent(me.id, "za"))) {
      setConsentDlg(true);
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    await ensureProfile(me);
    const { data, error } = await supabase
      .from("shops")
      .insert({
        owner_id: me.id,
        name: name.trim(),
        description: description.trim() || null,
        price_jpy: market === "ichi" ? null : price ? Number(price) : null,
        pay_url: market === "ichi" ? null : payUrl.trim() || null,
        is_trial: market === "ichi" ? isTrial : false,
        accepts_barter: barter,
        handover: market === "ichi" ? handover : null,
        accepts_tip: tip,
        category,
        market,
        image_urls: images.map((i) => i.full),
        thumb_urls: images.map((i) => i.thumb),
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setMessage(`出品できませんでした: ${error?.message ?? ""}`);
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.replace(`/za/${data.id}`);
  };

  return (
    <>
      {gateReady && !isWara && (
        <UpgradeDialog open onClose={() => router.push("/za")} feature="楽市楽座への出品" lp="/lp/za" />
      )}
    <main className="pb-20">
      <header
        className="flex items-center justify-between px-4 pb-3.5 pt-4"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/za" className="text-[13px] font-bold text-[#d4b96a] no-underline">
          ◀ 楽座
        </Link>
        <span className="text-[13px] font-extrabold tracking-widest text-[#f0e6c8]">楽座を出す</span>
        <span className="w-10" />
      </header>

      {!me || !isWara ? (
        <p className="px-5 py-10 text-center text-sm text-[#8a8070]">出品はわらわ〜会員から</p>
      ) : (
        <div className="space-y-4 px-2 pt-4">
          {/* 楽市 or 楽座 */}
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">どちらに出す？</label>
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#ede5d8] bg-[#f5efe2] p-1">
              {(
                [
                  ["ichi", "楽市", "０円かブツブツ交換"],
                  ["za", "楽座", "有料でプロの商品"],
                ] as const
              ).map(([id, label, sub]) => (
                <button
                  key={id}
                  onClick={() => setMarket(id)}
                  className="rounded-xl py-2 text-center"
                  style={
                    market === id
                      ? { background: "#c94d3a", color: "#fff" }
                      : { background: "transparent", color: "#8a8070" }
                  }
                >
                  <div className="text-[14px] font-extrabold leading-tight tracking-[3px]">{label}</div>
                  <div className="text-[9px] leading-tight opacity-85">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">品名・サービス名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 自然栽培のお米 5kg / 整体 60分"
              maxLength={60}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] outline-none focus:border-[#c94d3a]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">写真（4枚まで）</label>
            <div className="flex flex-wrap gap-2">
              {images.map((pair, i) => (
                <div key={pair.full} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pair.thumb} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                    aria-label="画像を削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#d8ccb4] text-[#b0a898]">
                  {uploading ? <span className="text-2xl">⏳</span> : <CameraIcon size={26} />}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-[10px] text-[#b8ae9c]">自動で圧縮されます（長辺1600px・WebP）</p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="どんなもの・どんなサービスか、こだわり、受け渡し方法など"
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">ジャンル</label>
            <div className="flex flex-wrap gap-1.5">
              {ZA_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={
                    category === c.id
                      ? { background: "#c94d3a", color: "#fff", borderColor: "#c94d3a" }
                      : { background: "#fff", color: "#5a5448", borderColor: "#ede5d8" }
                  }
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">受け取り方</label>
            <div className="space-y-2">
              {market === "ichi" ? (
                <>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
                    <input type="checkbox" checked={isTrial} onChange={(e) => setIsTrial(e.target.checked)} className="accent-[#c94d3a]" />
                    <span className="text-[13.5px]"><img src="/icons/icon-sprout.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 0円でゆずる</span>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
                    <input type="checkbox" checked={barter} onChange={(e) => setBarter(e.target.checked)} className="accent-[#c94d3a]" />
                    <span className="text-[13.5px]"><img src="/icons/icon-barter.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> ブツブツ交換で</span>
                  </label>
                  {/* ② 交換方法（受け渡しのしかた） */}
                  <div className="mt-1">
                    <div className="mb-1 text-[12px] font-extrabold text-[#8a7a5a]">② 交換方法を選ぶ</div>
                    <div className="flex flex-col gap-1.5">
                      {([["pickup", "取りに来てくれる人優先"], ["cod", "着払いでの郵送可"], ["both", "どちらもOK"]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setHandover(v)}
                          className="rounded-xl border-2 py-2 text-[13px] font-bold"
                          style={
                            handover === v
                              ? { borderColor: "#c94d3a", background: "#fff3f0", color: "#c94d3a" }
                              : { borderColor: "#ede5d8", background: "#fff", color: "#8a8070" }
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-[#ede5d8] bg-white px-3 py-2">
                    <span className="text-[13.5px]"><img src="/icons/icon-yen.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /></span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="価格（円）"
                      className="num w-full bg-transparent text-[14px] outline-none"
                    />
                    <span className="text-[12px] text-[#a09888]">円</span>
                  </div>
                  {/* 有料販売の決済リンク: BASE・PayPay等のURLを貼ると「購入はこちら」ボタンになる */}
                  <div className="rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
                    <div className="text-[11.5px] font-extrabold text-[#8a7a5a]">💳 購入リンク（BASE・PayPayなど）</div>
                    <input
                      value={payUrl}
                      onChange={(e) => setPayUrl(e.target.value)}
                      placeholder="BASEやPAYPAYなどのURL"
                      className="mt-1 w-full bg-transparent text-[13px] outline-none"
                    />
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#b0a890]">BASE / Shopify / PayPal / Stripe / PayPay など、あなたが使っている決済・ショップのリンクを貼れます。買う人には「購入はこちら」ボタンで表示されます</p>
                  </div>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
                    <input type="checkbox" checked={barter} onChange={(e) => setBarter(e.target.checked)} className="accent-[#c94d3a]" />
                    <span className="text-[13.5px]"><img src="/icons/icon-barter.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> ブツブツ交換もOK</span>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
                    <input type="checkbox" checked={tip} onChange={(e) => setTip(e.target.checked)} className="accent-[#c94d3a]" />
                    <span className="text-[13.5px]"><img src="/icons/icon-coin.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 投げ銭もOK</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {message && <p className="text-[12px] text-[#c05030]">{message}</p>}

          <button
            onClick={submit}
            disabled={!name.trim() || saving || uploading}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {saving ? "出品中..." : market === "ichi" ? "楽市に出す" : "楽座を出す"}
          </button>
        </div>
      )}
    </main>
    {consentDlg && me && (
      <ConsentDialog
        kind="za"
        userId={me.id}
        onAgreed={() => {
          setConsentDlg(false);
          submit();
        }}
        onClose={() => setConsentDlg(false)}
      />
    )}
    </>
  );
}
