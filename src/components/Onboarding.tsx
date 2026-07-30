"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";

/**
 * 初回登録。Google 認証の直後に一度だけ表示。
 * 名前・携帯番号・誕生日・誕生時刻・性別・DDP を入力し、
 * 位置情報の許可（OTOHIKARI・潮汐で使用）もここでまとめて取る。
 */
export function Onboarding({ user, onDone }: { user: User; onDone: () => void }) {
  const meta = user.user_metadata ?? {};
  const [name, setName] = useState((meta.full_name as string) ?? (meta.name as string) ?? "");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
  const [ddp, setDdp] = useState("");
  const [geo, setGeo] = useState<"none" | "asking" | "ok" | "ng">("none");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    const [r1, r2, r3] = await Promise.all([
      supabase
        .from("profiles")
        .update({ display_name: name.trim(), onboarded_at: now })
        .eq("id", user.id),
      supabase.from("private_profiles").upsert({
        user_id: user.id,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        birth_time: birthTime || null,
        gender: gender || null,
        updated_at: now,
      }),
      ddp.trim()
        ? supabase.from("ddp").upsert({ user_id: user.id, body: ddp.trim(), updated_at: now })
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const err = r1.error ?? r2.error ?? (r3 as { error: unknown }).error;
    if (err) {
      setMessage(`保存できませんでした: ${(err as { message?: string }).message ?? ""}`);
      return;
    }
    onDone();
  };

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
          あなたのことを教えてください。
          <br />
          手帳・占い・お知らせに使われます。
        </p>

        <div className="space-y-3.5 rounded-2xl bg-[#fffdf8] p-4">
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">お名前 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] outline-none focus:border-[#c94d3a]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">携帯番号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-0000-0000"
              className="num w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] outline-none focus:border-[#c94d3a]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生日</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-[14px] outline-none focus:border-[#c94d3a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
                誕生時刻 <span className="font-normal text-[#c0b8a8]">わかれば</span>
              </label>
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-[14px] outline-none focus:border-[#c94d3a]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">性別</label>
            <div className="flex gap-2.5">
              {[
                ["female", "女性"],
                ["male", "男性"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setGender(v)}
                  className="flex-1 rounded-xl border py-2.5 text-[14px] font-bold"
                  style={
                    gender === v
                      ? { background: "#c94d3a", color: "#fff", borderColor: "#c94d3a" }
                      : { background: "#fff", color: "#8a7a5a", borderColor: "#e8dcc4" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              DDP <span className="font-normal text-[#c0b8a8]">端的な夢・願い</span>
            </label>
            <textarea
              value={ddp}
              onChange={(e) => setDdp(e.target.value)}
              placeholder="願いを、ひとことで。"
              rows={2}
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
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
            シューマン音©を聴くとき地球儀にあなたの光が灯り、手帳に最寄り港の潮汐が出ます。
          </p>

          {message && <p className="text-[12px] text-[#c05030]">{message}</p>}

          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {saving ? "保存中..." : "はじめる 🌊"}
          </button>
        </div>
      </div>
    </div>
  );
}
