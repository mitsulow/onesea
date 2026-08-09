"use client";

import { moonOracleIdxOf } from "@/lib/almanac";
import { TechoBackupCard } from "@/components/TechoBackupCard";
import { useEffect, useRef, useState } from "react";
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
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState(""); // "female" | "male"
  const [birthPref, setBirthPref] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draftReady = useRef(false); // プロフィール読込完了後にだけ下書きを書く

  /* ── 下書き自動保存 ──
     引っ張り更新・横スワイプでの離脱・誤リロードなど、どんな理由でページが
     消えても、戻ってきたら入力途中の内容がそのまま復元される。保存成功で消す。 */
  const DRAFT_KEY = "onesea-profile-draft";
  useEffect(() => {
    if (!draftReady.current) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ts: Date.now(), displayName, statusLine, bio, prefecture, city, riceWork, lifeWork, skills, wants, sns, birthday, birthTime, gender, birthPref, birthCity })
      );
    } catch {}
  }, [displayName, statusLine, bio, prefecture, city, riceWork, lifeWork, skills, wants, sns, birthday, birthTime, gender, birthPref, birthCity]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      // 3日より古い下書きは捨てる(昔の書きかけが突然復活しないように)
      if (d.ts && Date.now() - d.ts > 3 * 86400000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (d.displayName != null) setDisplayName(d.displayName);
      if (d.statusLine != null) setStatusLine(d.statusLine);
      if (d.bio != null) setBio(d.bio);
      if (d.prefecture != null) setPrefecture(d.prefecture);
      if (d.city != null) setCity(d.city);
      if (d.riceWork != null) setRiceWork(d.riceWork);
      if (d.lifeWork != null) setLifeWork(d.lifeWork);
      if (d.skills != null) setSkills(d.skills);
      if (d.wants != null) setWants(d.wants);
      if (d.sns != null) setSns(d.sns);
      if (d.birthday != null) setBirthday(d.birthday);
      if (d.birthTime != null) setBirthTime(d.birthTime);
      if (d.gender != null) setGender(d.gender);
      if (d.birthPref != null) setBirthPref(d.birthPref);
      if (d.birthCity != null) setBirthCity(d.birthCity);
    } catch {}
  };

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
      // 誕生日・誕生時刻は private_profiles（登録フォームやツキヨガが使う）から吸い上げる。
      // いきなり課金で登録フォームを経ていない人も、ここで見えて直せる。
      const { data: priv } = await supabase
        .from("private_profiles")
        .select("birth_date, birth_time, gender, birth_pref, birth_city")
        .eq("user_id", u.id)
        .maybeSingle();
      if (priv?.gender) setGender(priv.gender as string);
      if (priv?.birth_pref) setBirthPref(priv.birth_pref as string);
      if (priv?.birth_city) setBirthCity(priv.birth_city as string);
      if (priv?.birth_date && !data?.birthday) setBirthday(priv.birth_date as string);
      // 読込が終わってから、残っている下書きを上書き復元(入力途中の方が新しい)
      restoreDraft();
      setTimeout(() => {
        draftReady.current = true;
      }, 0);
      if (priv?.birth_time) {
        const t = String(priv.birth_time).slice(0, 5);
        if (t !== "15:00") setBirthTime(t); // 既定の15:00は「未入力」として空欄扱い
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
        .filter(Boolean); // 無制限 — スキルは多いほど依頼が舞い込む
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
        moon_type: birthday ? moonOracleIdxOf(birthday, birthTime || "15:00") : null, // ツキヨガ12タイプ(マイページ表示用)
      })
      .eq("id", me.id);
    // 誕生日・誕生時刻はツキヨガ月占い等が読む private_profiles にも同期
    if (birthday || birthTime || gender || birthPref || birthCity) {
      await supabase.from("private_profiles").upsert({
        user_id: me.id,
        ...(birthday ? { birth_date: birthday } : {}),
        birth_time: birthTime || "15:00", // 未入力は15時
        gender: gender || null,
        birth_pref: birthPref.trim() || null,
        birth_city: birthCity.trim() || null,
      });
    }
    setSaving(false);
    if (error) {
      setMessage(`保存できませんでした: ${error.message}`);
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
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
          {field("名前", displayName, setDisplayName, "名前（ニックネームもOK）")}
          {field("みんなへひとこと", statusLine, setStatusLine, "例: 沖縄で自然栽培はじめました")}

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">スキル（私はこんなことが出来ます）</label>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              rows={3}
              placeholder="料理、デザイン、大工仕事、皿洗い、パソコン、運転、畑仕事、子守り、英語、動画編集、写真、経理、裁縫、マッサージ、話を聴くこと、片づけ、力仕事、歌、楽器、絵、文章、営業、励ますこと、肩もみ、…（多いほどマッチングします）"
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">※できるかぎり沢山のスキルを入力すると依頼が舞い込みます。「、」区切りで並べて行ってね（何個でもOK）</p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">やってみたいこと</label>
            <textarea
              value={wants}
              onChange={(e) => setWants(e.target.value)}
              rows={3}
              placeholder="田舎暮らし、パン屋さん、世界一周、出店、古民家再生、田植え、味噌づくり、バンド結成、映画づくり、絵本を出す、コミュニティ運営、月で暮らす、…（いくつでも）"
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">「、」区切りで何個でもOK</p>
          </div>

          {field("ライスワーク（今の仕事）", riceWork, setRiceWork, "いまの仕事")}
          {field("ライフワーク（本当にやりたいこと）", lifeWork, setLifeWork, "本当にやりたいこと")}

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="自分の魅力を簡単に書いてみよう"
              className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("都道府県", prefecture, setPrefecture, "例: 沖縄県")}
            {field("市町村", city, setCity, "例: 那覇市")}
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">生年月日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">名刺の「地球冒険◯日目」（生まれてから何日目）にも使われます</p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              誕生時刻 <span className="font-normal text-[#c0b8a8]">月占いに使います・分からなければ空欄でOK</span>
            </label>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
            />
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">未入力の場合は15時として占います（知らない人が多いので大丈夫）</p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">性別</label>
            <div className="flex gap-2">
              {([["female", "女性"], ["male", "男性"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
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
            <p className="mt-0.5 text-[10px] text-[#b8ae9c]">ツキヨガのZOOM受講の判定に使います</p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-bold text-[#8a7a5a]">
              生まれた場所 <span className="font-normal text-[#c0b8a8]">月占いに使います</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={birthPref}
                onChange={(e) => setBirthPref(e.target.value)}
                placeholder="都道府県"
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
              />
              <input
                value={birthCity}
                onChange={(e) => setBirthCity(e.target.value)}
                placeholder="市町村"
                className="w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] outline-none focus:border-[#c94d3a]"
              />
            </div>
          </div>

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

          <TechoBackupCard userId={me.id} />

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
