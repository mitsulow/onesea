"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";
import { SnsIcon } from "@/components/SnsIcon";

const SNS_FIELDS = [
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { id: "x", label: "X", placeholder: "https://x.com/..." },
  { id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@..." },
  { id: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
  { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
  { id: "threads", label: "Threads", placeholder: "https://threads.net/@..." },
  { id: "line", label: "LINE公式", placeholder: "https://lin.ee/..." },
  { id: "note", label: "note", placeholder: "https://note.com/..." },
  { id: "ameblo", label: "アメブロ", placeholder: "https://ameblo.jp/..." },
  { id: "website", label: "ウェブサイト", placeholder: "https://..." },
] as const;

/** プロフィール編集（楽市楽座のマイページ設定を移植） */
export default function ProfileSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [riceWork, setRiceWork] = useState("");
  const [lifeWork, setLifeWork] = useState("");
  const [skills, setSkills] = useState("");
  const [wants, setWants] = useState("");
  const [sns, setSns] = useState<Record<string, string>>({});
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) return;
      const prof = await ensureProfile(u);
      setUsername(prof.username);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, status_line, bio, prefecture, city, rice_work, life_work, skills, wants_to_do, sns, birthday")
        .eq("id", u.id)
        .single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setStatusLine(data.status_line ?? "");
        setBio(data.bio ?? "");
        setPrefecture(data.prefecture ?? "");
        setCity(data.city ?? "");
        setRiceWork(data.rice_work ?? "");
        setLifeWork(data.life_work ?? "");
        setSkills((data.skills ?? []).join("、"));
        setWants((data.wants_to_do ?? []).join("、"));
        setSns((data.sns as Record<string, string>) ?? {});
        setBirthday((data.birthday as string) ?? "");
      }
    });
  }, []);

  const save = async () => {
    if (!me || saving) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const toArr = (s: string) =>
      s
        .split(/[、,]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12);
    const snsClean: Record<string, string> = {};
    for (const [k, v] of Object.entries(sns)) if (v.trim()) snsClean[k] = v.trim();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        status_line: statusLine.trim() || null,
        bio: bio.trim() || null,
        prefecture: prefecture.trim() || null,
        city: city.trim() || null,
        rice_work: riceWork.trim() || null,
        life_work: lifeWork.trim() || null,
        skills: toArr(skills),
        wants_to_do: toArr(wants),
        sns: Object.keys(snsClean).length ? snsClean : null,
        birthday: birthday || null,
      })
      .eq("id", me.id);
    // 誕生日はツキヨガ等が読む private_profiles にも同期
    if (birthday) {
      await supabase.from("private_profiles").upsert({ user_id: me.id, birth_date: birthday });
    }
    setSaving(false);
    if (error) {
      setMessage(`保存できませんでした: ${error.message}`);
      return;
    }
    router.push(`/u/${username}`);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder = "",
    hint = ""
  ) => (
    <div>
      <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
      />
      {hint && <p className="mt-0.5 text-[10px] text-[#b8ae9c]">{hint}</p>}
    </div>
  );

  return (
    <main className="pb-20">
      <header
        className="flex items-center justify-between px-4 pb-3.5 pt-4"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/my" className="text-[13px] font-bold text-[#d4b96a] no-underline">
          ◀ マイページ
        </Link>
        <span className="text-[13px] font-extrabold tracking-widest text-[#f0e6c8]">プロフィール編集</span>
        <span className="w-14" />
      </header>

      {!me ? (
        <p className="px-5 py-10 text-center text-sm text-[#8a8070]">ログインしてください</p>
      ) : (
        <div className="space-y-4 px-4 pt-4">
          {field("表示名", displayName, setDisplayName, "名前")}
          {field("ひとこと", statusLine, setStatusLine, "例: 沖縄で自然栽培はじめました")}
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("都道府県", prefecture, setPrefecture, "例: 沖縄県")}
            {field("市町村", city, setCity, "例: 那覇市")}
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">誕生日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">名刺の「地球冒険◯日目」（生まれてから何日目）に使われます</p>
          </div>
          {field("ライスワーク", riceWork, setRiceWork, "いまの仕事")}
          {field("ライフワーク", lifeWork, setLifeWork, "本当にやりたいこと")}
          {field("スキル", skills, setSkills, "例: 料理、デザイン、大工", "「、」区切りで12個まで")}
          {field("やりたいこと", wants, setWants, "例: 田舎暮らし、出店", "「、」区切りで12個まで")}

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">SNS リンク</label>
            <div className="space-y-2">
              {SNS_FIELDS.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="flex w-24 flex-shrink-0 items-center gap-1.5 text-[11px] text-[#8a8070]">
                    <SnsIcon platform={f.id} size={18} />
                    {f.label}
                  </span>
                  <input
                    value={sns[f.id] ?? ""}
                    onChange={(e) => setSns({ ...sns, [f.id]: e.target.value })}
                    placeholder={f.placeholder}
                    className="min-w-0 flex-1 rounded-lg border border-[#ede5d8] bg-white px-2.5 py-2 text-[12px] outline-none focus:border-[#c94d3a]"
                  />
                </div>
              ))}
            </div>
          </div>

          {message && <p className="text-[12px] text-[#c05030]">{message}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#c94d3a" }}
          >
            {saving ? "保存中..." : "保存する"}
          </button>

          <div className="pt-6 text-center">
            <button onClick={logout} className="text-[12px] text-[#b0a898] underline">
              ログアウト
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
