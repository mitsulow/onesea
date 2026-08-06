"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";

/**
 * 無料OneSea会員の初回登録。Google 認証の直後に一度だけ表示。
 * 必須は名前と誕生日だけ。誕生日はカレンダーではなく年/月/日の
 * ホイール選択（年のデフォルト1980 — メイン顧客層。カレンダーで
 * 月を延々戻す事故を防ぐ）。誕生時刻は未選択なら15:00として保存。
 * 携帯・住所・DDP はここでは聞かない。
 * 保存後は「①無料で楽しむ ②わらわ〜へアップグレード」の2択。
 */

const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外",
];

const THIS_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = THIS_YEAR; y >= 1930; y--) YEARS.push(y);

/** 30分刻みの時刻リスト（誕生時刻の選択肢） */
const TIMES: string[] = [];
for (let h = 0; h < 24; h++) for (const m of ["00", "30"]) TIMES.push(`${String(h).padStart(2, "0")}:${m}`);

export function Onboarding({ user, onDone }: { user: User; onDone: () => void }) {
  const meta = user.user_metadata ?? {};
  const [name, setName] = useState((meta.full_name as string) ?? (meta.name as string) ?? "");
  const [bYear, setBYear] = useState(1980);
  const [bMonth, setBMonth] = useState(1);
  const [bDay, setBDay] = useState(1);
  const [birthTime, setBirthTime] = useState("");
  const [birthPref, setBirthPref] = useState("");
  const [geo, setGeo] = useState<"none" | "asking" | "ok" | "ng">("none");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const daysInMonth = useMemo(() => new Date(bYear, bMonth, 0).getDate(), [bYear, bMonth]);

  const askGeo = () => {
    if (!navigator.geolocation) {
      setGeo("ng");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(
            "onesea-pos",
            JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude, at: Date.now() })
          );
        } catch {}
        setGeo("ok");
      },
      () => setGeo("ng"),
      { timeout: 8000 }
    );
  };

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    await ensureProfile(user);
    const now = new Date().toISOString();
    const day = Math.min(bDay, daysInMonth);
    const birthDate = `${bYear}-${String(bMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const [r1, r2] = await Promise.all([
      supabase
        .from("profiles")
        .update({ display_name: name.trim(), onboarded_at: now })
        .eq("id", user.id),
      supabase.from("private_profiles").upsert({
        user_id: user.id,
        birth_date: birthDate,
        birth_time: birthTime || "15:00", // 分からない人は15時
        birth_pref: birthPref || null,
        updated_at: now,
      }),
    ]);
    setSaving(false);
    const err = r1.error ?? r2.error;
    if (err) {
      setMessage(`保存できませんでした: ${(err as { message?: string }).message ?? ""}`);
      return;
    }
    setDone(true);
  };

  const selCls =
    "w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-center text-[15px] outline-none focus:border-[#c94d3a]";

  /* 保存後: ①無料で楽しむ ②わらわ〜へ の2択 */
  if (done) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
      >
        <h1 className="text-[20px] font-extrabold tracking-[3px] text-[#f0e6c8]">
          ようこそ、OneSeaへ
        </h1>
        <p className="mt-3 text-[13px] leading-loose text-[#b8ccda]">
          無料OneSea会員の登録が完了しました。
          <br />
          手帳・シューマン共振・みんなの投稿が使えます。
        </p>
        <button
          onClick={onDone}
          className="mt-8 w-full max-w-[320px] rounded-2xl bg-white py-3.5 text-[15px] font-extrabold text-[#3a3428]"
        >
          ① まずは無料で楽しむ
        </button>
        <a
          href="/join"
          className="mt-3 block w-full max-w-[320px] rounded-2xl py-3.5 text-[14.5px] font-extrabold text-[#123] no-underline"
          style={{ background: "linear-gradient(120deg,#f0e6c8,#d4b96a)" }}
        >
          ② わらわ〜会員へアップグレード
        </a>
        <p className="mt-2.5 text-[10.5px] text-[#5a7a92]">
          シューマン音のフル再生・新月会満月会・楽座出品はわらわ〜会員で
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-5 py-8"
      style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
    >
      <div className="mx-auto max-w-[420px]">
        <h1 className="mb-6 text-center text-[22px] font-extrabold tracking-[4px] text-[#f0e6c8]">
          はじめまして
        </h1>

        <div className="space-y-3.5 rounded-2xl bg-[#fffdf8] p-4">
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              お名前 * <span className="font-normal text-[#c0b8a8]">ニックネームでOK</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] outline-none focus:border-[#c94d3a]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生日 *</label>
            <div className="grid grid-cols-3 gap-2">
              <select value={bYear} onChange={(e) => setBYear(Number(e.target.value))} className={selCls}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
              <select value={bMonth} onChange={(e) => setBMonth(Number(e.target.value))} className={selCls}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
              <select
                value={Math.min(bDay, daysInMonth)}
                onChange={(e) => setBDay(Number(e.target.value))}
                className={selCls}
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生時刻</label>
            <select value={birthTime} onChange={(e) => setBirthTime(e.target.value)} className={selCls}>
              <option value="">分からない人は15時に設定</option>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              生まれた都道府県 <span className="font-normal text-[#c0b8a8]">月占いが正確になります</span>
            </label>
            <select value={birthPref} onChange={(e) => setBirthPref(e.target.value)} className={selCls}>
              <option value="">選択しない</option>
              {PREFS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 位置情報はここでまとめて許可 */}
          <button
            onClick={askGeo}
            disabled={geo === "ok"}
            className="w-full rounded-xl border py-3 text-[13.5px] font-bold"
            style={
              geo === "ok"
                ? { background: "#eaf6ee", borderColor: "#3e9b6c", color: "#3e9b6c" }
                : { background: "#fff", borderColor: "#e8dcc4", color: "#8a7a5a" }
            }
          >
            {geo === "ok"
              ? "✅ 現在位置を使えます"
              : geo === "asking"
                ? "確認中..."
                : geo === "ng"
                  ? "📍 現在位置を許可（もう一度試す）"
                  : "📍 現在位置を許可する"}
          </button>
          <p className="-mt-1.5 text-[10.5px] leading-relaxed text-[#b8ae9c]">手帳アプリに使います</p>

          {message && <p className="text-[12px] text-[#c05030]">{message}</p>}

          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {saving ? "保存中..." : "OneSeaを使ってみる"}
          </button>
        </div>
      </div>
    </div>
  );
}
