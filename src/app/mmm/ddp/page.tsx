"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AvatarMenu } from "@/components/AvatarMenu";
import { fetchMyDdp, saveMyDdp } from "@/lib/mmm";

/**
 * 🌊 DDP設定 — 質問に答えていくと自動でDDPが導き出されるページ。
 * やりたくないこと → どうしたい？（やりたいこと=通り道）→ どうなりたい？（なりたいこと）
 * → なった瞬間の身体の感覚を「いま」味わう（なりたいはすべて一度経験した脳内の感覚）
 * → だから、どうありたい？（ありたいこと）→ DDPとして掲げる
 */

const GREEN_NEON = {
  color: "#7de0a0",
  textShadow: "0 0 8px rgba(110,230,150,.9), 0 0 20px rgba(70,210,120,.5)",
};

const STEPS = [
  {
    key: "not",
    title: "やりたくないことは、なに？",
    desc: "まずは吐き出そう。もうやりたくないこと、うんざりしていること。",
    placeholder: "例: 満員電車に乗りたくない / 上司に気をつかいたくない",
  },
  {
    key: "want",
    title: "じゃあ、どうしたいの？",
    desc: "やりたくないことの裏には「やりたいこと」「したいこと」が隠れている。",
    placeholder: "例: 海の近くで暮らしたい / 自分の店をやりたい",
  },
  {
    key: "become",
    title: "その道を通って、どう「なりたい」？",
    desc: "やりたいことは通り道。その先で、あなたはどうなりたい？",
    placeholder: "例: 豪邸に住みたい / お金持ちになりたい / 自由になりたい",
  },
  {
    key: "feel",
    title: "「なった」瞬間の、身体の感覚は？",
    desc: "目を閉じて想像して。それが叶った瞬間、胸のあたりは？呼吸は？体温は？——セロトニンやドーパミンのその感覚は、実は一度あなたが経験したことのある感覚。「なりたい」はぜんぶ、その感覚をもう一度出すために外側に求めているもの。だから、いま味わえる。",
    placeholder: "例: 胸があたたかい / 力が抜けて呼吸が深い / 顔がゆるむ",
  },
  {
    key: "be",
    title: "だったら、どう「ありたい」？",
    desc: "その感覚で毎日いられるとしたら——あなたはどんな「あり方」で生きる？それがDDP。",
    placeholder: "例: いつも胸があたたかい人でありたい / 海のように在りたい",
  },
] as const;

export default function DdpPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [current, setCurrent] = useState("");
  const [step, setStep] = useState(-1); // -1 = イントロ
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setCurrent(await fetchMyDdp(u.id));
    });
  }, []);

  const next = () => {
    if (!draft.trim()) return;
    setAnswers((a) => [...a, draft.trim()]);
    setDraft("");
    setStep((s) => s + 1);
  };

  const save = async () => {
    if (!me || !draft.trim() || saving) return;
    setSaving(true);
    await saveMyDdp(me.id, draft.trim());
    setSaving(false);
    setDone(true);
  };

  const s = step >= 0 && step < STEPS.length ? STEPS[step] : null;
  const isLast = step === STEPS.length - 1;

  return (
    <main className="min-h-screen pb-24" style={{ background: "linear-gradient(180deg,#0a1410,#0f1a25)" }}>
      <header className="relative z-[60] flex items-center justify-center px-6 py-2" style={{ background: "#0a1410" }}>
        <span className="text-[16px] font-extrabold tracking-[3px]" style={GREEN_NEON}>
          <img src="/icons/icon-ddp.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> DDP設定
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <AvatarMenu ring="#7de0a0" />
        </span>
      </header>

      <div className="px-5 pt-6">
        {done ? (
          <div className="text-center">
            <div className="flex justify-center"><img src="/icons/icon-ddp.webp" alt="" style={{ width: 56, height: 56 }} /></div>
            <div className="mt-2 text-[15px] font-extrabold text-[#d8f0e0]">DDPを掲げました</div>
            <div className="mt-3 rounded-2xl border border-[#2a4a3a] bg-[#0c1812] px-4 py-4 text-[16px] font-extrabold leading-relaxed text-[#7de0a0]">
              {draft}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[#5a7a68]">
              あなたのDDPはマイページとニューラFIVEの班に表示されます。
              <br />
              節分かれつ刻ごとに、いつでも書き換えてOK。
            </p>
            <button
              onClick={() => router.push("/mmm/neura")}
              className="mt-5 w-full rounded-xl py-3 text-[14px] font-extrabold text-[#0a1410]"
              style={{ background: "linear-gradient(135deg,#a0e8b8,#7de0a0)" }}
            >
              <img src="/icons/icon-neura5.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3.5 }} /> ニューラFIVEへ →
            </button>
          </div>
        ) : step === -1 ? (
          <div>
            <div className="flex justify-center"><img src="/icons/icon-ddp.webp" alt="" style={{ width: 52, height: 52 }} /></div>
            <h1 className="mt-2 text-center text-[17px] font-extrabold leading-snug text-[#d8f0e0]">
              質問に答えていくだけで、
              <br />
              あなたのDDPが見つかる
            </h1>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#7a9a88]">
              DDP＝端的な夢。「やりたくないこと」から出発して、「やりたい」→「なりたい」→
              身体の感覚→「ありたい」へ、5つの質問で潜っていきます。所要3分。
            </p>
            {current && (
              <div className="mt-3 rounded-xl border border-[#2a4a3a] bg-[#0c1812] px-3 py-2.5">
                <div className="text-[9.5px] font-bold tracking-[2px] text-[#5a7a68]">いまのDDP</div>
                <div className="text-[14px] font-bold text-[#d8f0e0]">{current}</div>
              </div>
            )}
            <button
              onClick={() => setStep(0)}
              className="mt-5 w-full rounded-xl py-3.5 text-[15px] font-extrabold text-[#0a1410]"
              style={{ background: "linear-gradient(135deg,#a0e8b8,#7de0a0)" }}
            >
              はじめる
            </button>
          </div>
        ) : s ? (
          <div>
            {/* 進捗ドット */}
            <div className="mb-5 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 22 : 8,
                    background: i <= step ? "#7de0a0" : "#1e3a2a",
                  }}
                />
              ))}
            </div>

            {step === 3 && answers[2] && (
              <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-[12px] text-[#8ab89a]">
                「{answers[2]}」……なったつもりで、目を閉じて10秒。
              </div>
            )}

            <h2 className="text-[18px] font-extrabold leading-snug text-[#d8f0e0]">{s.title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[#7a9a88]">{s.desc}</p>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={step === STEPS.length - 1 ? 60 : 200}
              autoFocus
              placeholder={s.placeholder}
              className="mt-4 w-full resize-y rounded-xl border border-[#2a4a3a] bg-[#0c1812] p-3.5 text-[15px] leading-relaxed text-[#d8f0e0] outline-none focus:border-[#7de0a0]"
            />
            {isLast && <div className="mt-1 text-right text-[10px] text-[#5a7a68]">{draft.length}/60 — これがそのままDDPになります</div>}

            <div className="mt-4 flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => {
                    setDraft(answers[step - 1] ?? "");
                    setAnswers((a) => a.slice(0, -1));
                    setStep((x) => x - 1);
                  }}
                  className="rounded-xl px-4 py-3 text-[12.5px] font-bold text-[#5a7a68]"
                >
                  ← もどる
                </button>
              )}
              <button
                onClick={isLast ? save : next}
                disabled={!draft.trim() || saving}
                className="flex-1 rounded-xl py-3 text-[14.5px] font-extrabold text-[#0a1410] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#a0e8b8,#7de0a0)" }}
              >
                {isLast ? (saving ? "掲げています..." : "これをDDPとして掲げる") : "つぎへ →"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
