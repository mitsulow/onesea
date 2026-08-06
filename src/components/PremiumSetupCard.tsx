"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWarawaMissing, WarawaMissing } from "@/lib/warawa";

const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外",
];

/**
 * わらわ〜会員の未入力情報カード（自分のマイページにだけ出る）。
 * 携帯番号・お住まいの市町村・DDP — 全部埋まるまで右上バッジ（数字）が消えない。
 */
export function PremiumSetupCard({ userId }: { userId: string }) {
  const [status, setStatus] = useState<WarawaMissing | null>(null);
  const [phone, setPhone] = useState("");
  const [pref, setPref] = useState("");
  const [city, setCity] = useState("");
  const [ddp, setDdp] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchWarawaMissing(userId).then(setStatus);
  }, [userId]);

  if (!status?.isWara || status.missing.length === 0) return null;
  const need = new Set(status.missing);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const jobs: PromiseLike<{ error: unknown }>[] = [];
    if (need.has("phone") && phone.trim()) {
      jobs.push(supabase.from("private_profiles").upsert({ user_id: userId, phone: phone.trim(), updated_at: now }));
    }
    if (need.has("city") && pref && city.trim()) {
      jobs.push(supabase.from("profiles").update({ prefecture: pref, city: city.trim() }).eq("id", userId));
    }
    if (need.has("ddp") && ddp.trim()) {
      jobs.push(supabase.from("ddp").upsert({ user_id: userId, body: ddp.trim(), updated_at: now }));
    }
    const results = await Promise.all(jobs);
    setSaving(false);
    const err = results.find((r) => r.error);
    if (err) {
      setMessage("保存できませんでした。通信環境を確認してください");
      return;
    }
    const next = await fetchWarawaMissing(userId);
    setStatus(next);
    // 右上バッジへ更新を知らせる
    window.dispatchEvent(new Event("onesea:warawaMissingRefresh"));
  };

  const label = "mb-1 block text-[12px] font-bold text-[#8a7a5a]";
  const input =
    "w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-[14px] outline-none focus:border-[#c94d3a]";

  return (
    <section
      className="mx-4 mt-3 rounded-2xl border p-4"
      style={{ borderColor: "#d4b96a", background: "linear-gradient(160deg,#fffaf0,#fdf3da)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white"
          style={{ background: "#c94d3a" }}
        >
          {status.missing.length}
        </span>
        <span className="text-[13.5px] font-extrabold text-[#7a5a10]">
          わらわ〜会員の登録情報が残っています
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {need.has("phone") && (
          <div>
            <label className={label}>
              携帯番号 <span className="font-normal text-[#c0b8a8]">公開されません</span>
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-0000-0000" className={"num " + input} />
          </div>
        )}
        {need.has("city") && (
          <div>
            <label className={label}>
              住んでいる市町村 <span className="font-normal text-[#c0b8a8]">公開されません</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select value={pref} onChange={(e) => setPref(e.target.value)} className={input}>
                <option value="">都道府県</option>
                {PREFS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="市町村" className={input} />
            </div>
          </div>
        )}
        {need.has("ddp") && (
          <div>
            <label className={label}>
              DDP <span className="font-normal text-[#c0b8a8]">端的な夢・願いをひとことで</span>
            </label>
            <textarea value={ddp} onChange={(e) => setDdp(e.target.value)} rows={2} className={input + " resize-y"} />
          </div>
        )}
        {message && <p className="text-[12px] text-[#c05030]">{message}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
          style={{ background: "#c94d3a" }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </section>
  );
}
