"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureAuthAlive } from "@/components/ServiceStatus";
import { ensureProfile } from "@/lib/cotozute";
import { isWarawaUntil } from "@/lib/warawa";
import MUNI from "@/data/municipalities.json";

/**
 * わらわ〜会員の入金後の本登録。LP（模擬Stripeボタン）から戻ってきた人が着地。
 * 最初は最小限だけ聞く: 名前・お住まいの県/市町村・携帯番号(必須)。
 * 誕生日やDDP・おススメの店などは、後からマイページで任意に。
 * ログイン確認 → warawa_until(+1年)付与 → 最小フォーム → 完了。
 * ※模擬システム: 後日 Stripe webhook の決済確認でサーバー側付与に差し替え。
 */

const MUNI_MAP = MUNI as unknown as Record<string, [string, number, number][]>;
const PREFS = [...Object.keys(MUNI_MAP), "海外"];

export default function JoinCompletePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<"loading" | "needLogin" | "form" | "done">("loading");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pref, setPref] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      // 既存値を前埋め（無料会員→わらわ〜の人は名前が入っている）
      const meta = u.user_metadata ?? {};
      setName((prof?.display_name as string) || (meta.full_name as string) || (meta.name as string) || "");
      if (prof?.prefecture) setPref(prof.prefecture as string);
      if (prof?.city) setCity(prof.city as string);
      const { data: priv } = await supabase.from("private_profiles").select("phone").eq("user_id", u.id).maybeSingle();
      if (priv?.phone) setPhone(priv.phone as string);
      setPhase("form");
    });
  }, []);

  const login = async () => {
    if (!(await ensureAuthAlive())) return; // 障害中は赤帯を出して固まらせない
    try { localStorage.setItem("onesea-return", "/join/complete"); } catch {}
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/callback`, queryParams: { prompt: "select_account" } } });
  };

  const submit = async () => {
    if (!user || saving) return;
    if (!name.trim()) { setMsg("お名前を入力してください"); return; }
    if (!phone.trim()) { setMsg("携帯番号は必須です（事務局からご連絡します）"); return; }
    setSaving(true); setMsg(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const [r1, r2] = await Promise.all([
      supabase.from("profiles").update({
        display_name: name.trim(),
        onboarded_at: now,
        prefecture: pref || null,
        city: city.trim() || null,
      }).eq("id", user.id),
      supabase.from("private_profiles").upsert({ user_id: user.id, phone: phone.trim(), updated_at: now }),
    ]);
    setSaving(false);
    const err = r1.error ?? r2.error;
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
        <p className="mb-6 text-center text-[11.5px] text-[#7a9ab4]">まずは3つだけ。あとはマイページでいつでも編集できます</p>

        <div className="space-y-3.5 rounded-2xl bg-[#fffdf8] p-4">
          <div>
            <label className={lbl}>お名前 * <span className="font-normal text-[#c0b8a8]">ニックネームでOK</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
          </div>

          <div>
            <label className={lbl}>携帯番号 * <span className="font-normal text-[#c0b8a8]">事務局からご連絡します・公開されません</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-0000-0000" className={"num " + inp} />
          </div>

          <div>
            <label className={lbl}>お住まいの市町村 * <span className="font-normal text-[#c0b8a8]">ニューラ班・セカイムラで使います・公開されません</span></label>
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

          {msg && <p className="text-[12px] text-[#c05030]">{msg}</p>}

          <button onClick={submit} disabled={saving} className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c94d3a" }}>
            {saving ? "保存中..." : "登録して、はじめる"}
          </button>
          <p className="text-center text-[10.5px] text-[#b0a890]">誕生日・占い・おススメの店などは、マイページでいつでも追加できます</p>
        </div>
      </div>
    </main>
  );
}
