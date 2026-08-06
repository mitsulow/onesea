"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWarawaMissing, WarawaMissing } from "@/lib/warawa";
import MUNI from "@/data/municipalities.json";

// 都道府県 → 市町村（全国1,916自治体）。Onboarding と同じ自動表示方式。
const MUNI_MAP = MUNI as unknown as Record<string, [string, number, number][]>;
const PREFS = [...Object.keys(MUNI_MAP), "海外"];

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
  const cityOptions = useMemo<string[]>(() => (pref && pref !== "海外" ? (MUNI_MAP[pref] ?? []).map((c) => c[0]) : []), [pref]);

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
              <select
                value={pref}
                onChange={(e) => { setPref(e.target.value); setCity(""); }}
                className={input}
              >
                <option value="">都道府県</option>
                {PREFS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {pref === "海外" ? (
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="都市名" className={input} />
              ) : (
                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!pref} className={input}>
                  <option value="">{pref ? "市町村を選択" : "先に都道府県"}</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
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
