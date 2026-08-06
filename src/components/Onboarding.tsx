"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";

/**
 * 無料OneSea会員の初回登録。Google 認証の直後に一度だけ表示。
 * 必須は名前と誕生日だけ（30秒で終わる）。
 * 誕生時刻は未入力なら15:00として保存（占いの経度補正用に出生地の都道府県も任意で）。
 * 携帯・住所・DDP はここでは聞かない（わらわ〜入会時・MMM初回に文脈つきで）。
 * 保存後は「①無料で楽しむ ②わらわ〜へアップグレード」の2択を出す。
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

export function Onboarding({ user, onDone }: { user: User; onDone: () => void }) {
  const meta = user.user_metadata ?? {};
  const [name, setName] = useState((meta.full_name as string) ?? (meta.name as string) ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPref, setBirthPref] = useState("");
  const [geo, setGeo] = useState<"none" | "asking" | "ok" | "ng">("none");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (!name.trim() || !birthDate || saving) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    await ensureProfile(user);
    const now = new Date().toISOString();
    const [r1, r2] = await Promise.all([
      supabase
        .from("profiles")
        .update({ display_name: name.trim(), onboarded_at: now })
        .eq("id", user.id),
      supabase.from("private_profiles").upsert({
        user_id: user.id,
        birth_date: birthDate,
        birth_time: birthTime || "15:00", // 未入力は15時とみなす（正午±3hの安全側・占い用）
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

  /* 保存後: ①無料で楽しむ ②わらわ〜へ の2択 */
  if (done) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
      >
        <div className="text-[44px]">🌊</div>
        <h1 className="mt-2 text-[20px] font-extrabold tracking-[3px] text-[#f0e6c8]">
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
        <h1 className="text-center text-[22px] font-extrabold tracking-[4px] text-[#f0e6c8]">
          はじめまして 🌊
        </h1>
        <p className="mb-6 mt-1.5 text-center text-[12.5px] leading-relaxed text-[#9ab8cc]">
          30秒で終わります。
          <br />
          手帳・占い・お知らせに使われます。
        </p>

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生日 *</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-[14px] outline-none focus:border-[#c94d3a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生時刻</label>
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-[14px] outline-none focus:border-[#c94d3a]"
              />
            </div>
          </div>
          <p className="-mt-2 text-[10.5px] leading-relaxed text-[#b8ae9c]">
            誕生時刻が分からない人は15時に設定されます（知らない人の方が多いので大丈夫）。
          </p>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              生まれた都道府県 <span className="font-normal text-[#c0b8a8]">月占いが正確になります</span>
            </label>
            <select
              value={birthPref}
              onChange={(e) => setBirthPref(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
            >
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
          <p className="-mt-1.5 text-[10.5px] leading-relaxed text-[#b8ae9c]">
            シューマン音©を聴くとき地球儀にあなたの光が灯り、手帳に最寄り港の潮汐が出ます。許可しなくても使えます。
          </p>

          {message && <p className="text-[12px] text-[#c05030]">{message}</p>}

          <button
            onClick={submit}
            disabled={!name.trim() || !birthDate || saving}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {saving ? "保存中..." : "無料OneSea会員に登録する 🌊"}
          </button>
        </div>
      </div>
    </div>
  );
}
