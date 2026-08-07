"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";

/**
 * 初回登録カード。Google ログイン後のマイページで
 * DDP（端的な夢）・誕生日・誕生時刻・性別を入力してもらう。
 * 誕生日と DDP が揃っていれば表示しない。ツキヨガ等が後で利用する。
 */
export function ProfileSetup() {
  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState(false);
  const [ddp, setDdp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) return;
      await ensureProfile(u);
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from("ddp").select("body").eq("user_id", u.id).maybeSingle(),
        supabase.from("private_profiles").select("birth_date, birth_time, gender").eq("user_id", u.id).maybeSingle(),
      ]);
      if (d?.body) setDdp(d.body);
      if (p?.birth_date) setBirthDate(p.birth_date);
      if (p?.birth_time) setBirthTime(String(p.birth_time).slice(0, 5));
      if (p?.gender) setGender(p.gender);
      // DDP と誕生日が揃っていなければ初回カードを出す
      if (!d?.body || !p?.birth_date) setShow(true);
    });
  }, []);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    const supabase = createClient();
    await Promise.all([
      supabase.from("ddp").upsert({ user_id: user.id, body: ddp.trim(), updated_at: new Date().toISOString() }),
      supabase.from("private_profiles").upsert({
        user_id: user.id,
        birth_date: birthDate || null,
        birth_time: birthTime || null,
        gender: gender || null,
        updated_at: new Date().toISOString(),
      }),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setShow(false), 1200);
  };

  if (!user || !show) return null;

  return (
    <section
      className="card"
      style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)", border: "1.5px solid #d4b96a66" }}
    >
      <div className="sec mb-2"><img src="/icons/icon-wave.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} /> はじめまして — あなたのことを教えてください</div>

      <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
        DDP <span className="font-normal text-[#c0b8a8]">端的な夢・願い</span>
      </label>
      <textarea
        value={ddp}
        onChange={(e) => setDdp(e.target.value)}
        placeholder="願いを、ひとことで。"
        rows={2}
        className="mb-3 w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-[#c94d3a]"
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
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

      <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">性別</label>
      <div className="mb-4 flex gap-2.5">
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

      <button
        onClick={save}
        disabled={saving || (!ddp.trim() && !birthDate)}
        className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
        style={{ background: "#c94d3a" }}
      >
        {saved ? "保存しました 🌿" : saving ? "保存中..." : "はじめる"}
      </button>
      <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[#b8ae9c]">
        誕生日・誕生時刻・性別はあなただけが見られるデータです。<br />
        ツキヨガなど、あなた向けの体験に使われます。
      </p>
    </section>
  );
}
