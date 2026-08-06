"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";
import { isWarawaUntil } from "@/lib/warawa";
import MUNI from "@/data/municipalities.json";

/**
 * わらわ〜会員の入金後の本登録。LP（模擬Stripeボタン）から戻ってきた人が着地。
 * いきなり課金した人は①名前②誕生日等も未登録なので、ここで全部まとめて登録させる。
 * 携帯番号は必須（事務局から連絡が行く）。
 * ログイン確認 → warawa_until(+1年)付与 → 全項目フォーム → /my。
 * ※模擬システム: 後日 Stripe webhook の決済確認でサーバー側付与に差し替え。
 */

const MUNI_MAP = MUNI as unknown as Record<string, [string, number, number][]>;
const PREFS = [...Object.keys(MUNI_MAP), "海外"];
const COUNTRIES = ["アメリカ", "カナダ", "イギリス", "フランス", "ドイツ", "オーストラリア", "中国", "台湾", "韓国", "タイ", "シンガポール", "その他"];
const THIS_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = THIS_YEAR; y >= 1930; y--) YEARS.push(y);

export default function JoinCompletePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<"loading" | "needLogin" | "form" | "done">("loading");

  const [name, setName] = useState("");
  const [bYear, setBYear] = useState(1980);
  const [bMonth, setBMonth] = useState(1);
  const [bDay, setBDay] = useState(1);
  const [bHour, setBHour] = useState("");
  const [bMin, setBMin] = useState(0);
  const [birthPref, setBirthPref] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [phone, setPhone] = useState("");
  const [pref, setPref] = useState("");
  const [city, setCity] = useState("");
  const [ddp, setDdp] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const daysInMonth = useMemo(() => new Date(bYear, bMonth, 0).getDate(), [bYear, bMonth]);
  const birthCityOpts = useMemo<string[]>(() => (!birthPref ? [] : birthPref === "海外" ? COUNTRIES : (MUNI_MAP[birthPref] ?? []).map((c) => c[0])), [birthPref]);
  const cityOpts = useMemo<string[]>(() => (pref && pref !== "海外" ? (MUNI_MAP[pref] ?? []).map((c) => c[0]) : []), [pref]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user;
      if (!u) { setPhase("needLogin"); return; }
      setUser(u);
      await ensureProfile(u);
      // わらわ〜を付与（サーバー側=service_role）
      const { data: prof } = await supabase
        .from("profiles")
        .select("warawa_until, display_name, prefecture, city")
        .eq("id", u.id)
        .maybeSingle();
      if (!isWarawaUntil(prof?.warawa_until as string | null)) {
        const token = session?.access_token;
        if (token) await fetch("/api/warawa/grant", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      }
      // 既存値を前埋め（無料会員→わらわ〜の人は名前・誕生日が入っている）
      const meta = u.user_metadata ?? {};
      setName((prof?.display_name as string) || (meta.full_name as string) || (meta.name as string) || "");
      if (prof?.prefecture) setPref(prof.prefecture as string);
      if (prof?.city) setCity(prof.city as string);
      const { data: priv } = await supabase.from("private_profiles").select("phone, birth_date, birth_time, birth_pref, birth_city").eq("user_id", u.id).maybeSingle();
      if (priv?.phone) setPhone(priv.phone as string);
      if (priv?.birth_date) {
        const [y, m, d] = (priv.birth_date as string).split("-").map(Number);
        if (y) { setBYear(y); setBMonth(m); setBDay(d); }
      }
      if (priv?.birth_time) {
        const [h, mi] = (priv.birth_time as string).split(":").map(Number);
        if (!isNaN(h) && !(h === 15 && mi === 0)) { setBHour(String(h)); setBMin(mi || 0); }
      }
      if (priv?.birth_pref) setBirthPref(priv.birth_pref as string);
      if (priv?.birth_city) setBirthCity(priv.birth_city as string);
      const { data: d0 } = await supabase.from("ddp").select("body").eq("user_id", u.id).maybeSingle();
      if (d0?.body) setDdp(d0.body as string);
      setPhase("form");
    });
  }, []);

  const login = async () => {
    try { localStorage.setItem("onesea-return", "/join/complete"); } catch {}
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/callback` } });
  };

  const submit = async () => {
    if (!user || saving) return;
    if (!name.trim()) { setMsg("お名前を入力してください"); return; }
    if (!phone.trim()) { setMsg("携帯番号は必須です（事務局からご連絡します）"); return; }
    setSaving(true); setMsg(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const day = Math.min(bDay, daysInMonth);
    const birthDate = `${bYear}-${String(bMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const [r1, r2, r3] = await Promise.all([
      supabase.from("profiles").update({
        display_name: name.trim(),
        onboarded_at: now,
        prefecture: pref || null,
        city: city.trim() || null,
      }).eq("id", user.id),
      supabase.from("private_profiles").upsert({
        user_id: user.id,
        phone: phone.trim(),
        birth_date: birthDate,
        birth_time: bHour === "" ? "15:00" : `${bHour.padStart(2, "0")}:${String(bMin).padStart(2, "0")}`,
        birth_pref: birthPref || null,
        birth_city: birthCity || null,
        updated_at: now,
      }),
      ddp.trim() ? supabase.from("ddp").upsert({ user_id: user.id, body: ddp.trim(), updated_at: now }) : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const err = r1.error ?? r2.error ?? (r3 as { error: unknown }).error;
    if (err) { setMsg("保存できませんでした。通信環境をご確認ください"); return; }
    window.dispatchEvent(new Event("onesea:warawaMissingRefresh"));
    setPhase("done");
  };

  const sel = "w-full rounded-xl border border-[#e8dcc4] bg-white p-2.5 text-center text-[15px] outline-none focus:border-[#c94d3a]";
  const inp = "w-full rounded-xl border border-[#e8dcc4] bg-white p-3 text-[15px] outline-none focus:border-[#c94d3a]";
  const lbl = "mb-1 block text-[12px] font-bold text-[#8a7a5a]";
  const bg = { background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" };

  if (phase === "loading") {
    return <main className="flex min-h-dvh items-center justify-center" style={bg}><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" /></main>;
  }
  if (phase === "needLogin") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" style={bg}>
        <h1 className="text-[19px] font-extrabold tracking-[3px] text-[#f0e6c8]">ご入金ありがとうございます</h1>
        <p className="mt-3 text-[13px] leading-loose text-[#b8ccda]">Googleでログインすると、わらわ〜会員の登録に進みます。</p>
        <button onClick={login} className="mt-6 w-full max-w-[300px] rounded-2xl bg-white py-3.5 text-[14.5px] font-extrabold text-[#3a3428]">Googleでログイン</button>
      </main>
    );
  }
  if (phase === "done") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" style={bg}>
        <h1 className="text-[22px] font-extrabold tracking-[3px] text-[#f0e6c8]">ようこそ、わらわ〜会員へ</h1>
        <p className="mt-3 text-[13px] leading-loose text-[#b8ccda]">すべての海が、開きました。<br />四つの扉、ぜんぶお楽しみください。</p>
        <a href="/" className="mt-8 block w-full max-w-[320px] rounded-2xl py-3.5 text-[15px] font-extrabold text-[#123] no-underline" style={{ background: "linear-gradient(120deg,#f0e6c8,#d4b96a)" }}>全機能を使いはじめる</a>
      </main>
    );
  }

  // 本登録フォーム
  return (
    <main className="min-h-dvh px-5 py-8" style={bg}>
      <div className="mx-auto max-w-[420px]">
        <div className="text-center text-[12px] tracking-[3px] text-[#9ab8cc]">ご入金ありがとうございます</div>
        <h1 className="mb-1 mt-1 text-center text-[21px] font-extrabold tracking-[3px] text-[#f0e6c8]">わらわ〜会員 本登録</h1>
        <p className="mb-6 text-center text-[11.5px] text-[#7a9ab4]">お手続きに必要な情報をご登録ください</p>

        <div className="space-y-3.5 rounded-2xl bg-[#fffdf8] p-4">
          <div>
            <label className={lbl}>お名前 * <span className="font-normal text-[#c0b8a8]">ニックネームでOK</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
          </div>

          <div>
            <label className={lbl}>誕生日 *</label>
            <div className="grid grid-cols-3 gap-2">
              <select value={bYear} onChange={(e) => setBYear(Number(e.target.value))} className={sel}>{YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}</select>
              <select value={bMonth} onChange={(e) => setBMonth(Number(e.target.value))} className={sel}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}</select>
              <select value={Math.min(bDay, daysInMonth)} onChange={(e) => setBDay(Number(e.target.value))} className={sel}>{Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}日</option>)}</select>
            </div>
          </div>

          <div>
            <label className={lbl}>誕生時刻 <span className="font-normal text-[#c0b8a8]">月占いが正確になります</span></label>
            <div className="flex gap-2">
              <select value={bHour} onChange={(e) => setBHour(e.target.value)} className={sel + (bHour === "" ? " flex-[2]" : " flex-1")}>
                <option value="">分からない人は15時に設定</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{h}時</option>)}
              </select>
              {bHour !== "" && <select value={bMin} onChange={(e) => setBMin(Number(e.target.value))} className={sel + " flex-1"}>{Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{m}分</option>)}</select>}
            </div>
          </div>

          <div>
            <label className={lbl}>生まれた場所 <span className="font-normal text-[#c0b8a8]">月占いが正確になります</span></label>
            <div className="space-y-2">
              <select value={birthPref} onChange={(e) => { setBirthPref(e.target.value); setBirthCity(""); }} className={sel}>
                <option value="">選択しない</option>
                {PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {birthPref && (
                <select value={birthCity} onChange={(e) => setBirthCity(e.target.value)} className={sel}>
                  <option value="">{birthPref === "海外" ? "国を選択" : "市町村を選択"}</option>
                  {birthCityOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="h-px bg-[#eee6d4]" />

          <div>
            <label className={lbl}>携帯番号 * <span className="font-normal text-[#c0b8a8]">事務局からご連絡します・公開されません</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-0000-0000" className={"num " + inp} />
          </div>

          <div>
            <label className={lbl}>お住まいの市町村 <span className="font-normal text-[#c0b8a8]">ニューラ班・セカイムラで使います・公開されません</span></label>
            <div className="grid grid-cols-2 gap-2">
              <select value={pref} onChange={(e) => { setPref(e.target.value); setCity(""); }} className={sel}>
                <option value="">都道府県</option>
                {PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {pref === "海外" ? (
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="都市名" className={inp} />
              ) : (
                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!pref} className={sel}>
                  <option value="">{pref ? "市町村を選択" : "先に都道府県"}</option>
                  {cityOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={lbl}>DDP <span className="font-normal text-[#c0b8a8]">端的な夢・願いをひとことで</span></label>
            <textarea value={ddp} onChange={(e) => setDdp(e.target.value)} rows={2} className={inp + " resize-y"} />
          </div>

          {msg && <p className="text-[12px] text-[#c05030]">{msg}</p>}

          <button onClick={submit} disabled={saving} className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c94d3a" }}>
            {saving ? "保存中..." : "本登録を完了する"}
          </button>
        </div>
      </div>
    </main>
  );
}
