"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PREFS } from "@/lib/sekai";
import { IosBackButton } from "@/components/IosBackButton";

const G = "#2a7a48";

/** 質問定義。事務局が画面上で編集でき、DB(kome_hearing_config)に保存される。 */
export type Q = { id: string; sec: string; label: string; type: "text" | "textarea" | "radio" | "check" | "select"; opts?: string[]; req: boolean; max?: number; desc?: string; ph?: string };

const PREF_OPTS = [...PREFS, "その他（海外）"];
/** 初期の質問セット(DB未保存時のデフォルト。保存後はDBが正) */
const DEFAULT_QUESTIONS: Q[] = [
  { id: "furigana", sec: "1. 田んぼの基本情報", label: "オーナー名のふりがな", type: "text", req: true },
  { id: "who", sec: "1. 田んぼの基本情報", label: "主にお米づくりをされている方はどなたですか？", type: "radio", opts: ["ご本人", "ご家族", "ご友人"], req: true },
  { id: "tanbo_name", sec: "1. 田んぼの基本情報", label: "登録される田んぼの名称", type: "text", req: true, ph: "（例）やまださんちの田んぼ、笑顔の庭 など" },
  { id: "pref", sec: "1. 田んぼの基本情報", label: "田んぼがある都道府県", type: "select", opts: PREF_OPTS, req: true },
  { id: "address", sec: "1. 田んぼの基本情報", label: "田んぼの所在地", type: "text", req: true },
  { id: "map_style", sec: "1. 田んぼの基本情報", label: "MAP掲載方法", type: "radio", opts: ["①田んぼの正確な位置を掲載する", "②田んぼ近隣の公共施設や駅、郵便局を指定する"], req: true, desc: "※米部のMAPはセカイムラメンバーだけでなく、どなたでも閲覧できます。住所公開にご不安がある方は、②田んぼの近くの公共施設や駅をご選択ください。" },
  { id: "map_link", sec: "1. 田んぼの基本情報", label: "①の方はGoogleマップのURL、②の方は掲載する住所や施設名を記入", type: "text", req: true, desc: "番地がないと正確な位置を掲載することができません。①を選択されGoogleマップのURL記載がない場合、近隣の公共施設や駅、郵便局、神社などをこちらで設定させていただきます。" },
  { id: "size", sec: "1. 田んぼの基本情報", label: "田んぼの広さ", type: "text", req: true, ph: "（例）2反" },
  { id: "method", sec: "1. 田んぼの基本情報", label: "現在の栽培方法", type: "radio", opts: ["自然栽培", "有機栽培", "慣行栽培", "減農薬栽培", "その他"], req: true },
  { id: "crops", sec: "1. 田んぼの基本情報", label: "現在栽培している品目", type: "text", req: true, ph: "例）コシヒカリ・黒米・にこまる など" },
  { id: "sns", sec: "1. 田んぼの基本情報", label: "SNS・WEBサイト（あれば）", type: "text", req: false },
  { id: "years", sec: "2. 農業経験について", label: "お米づくりの経験年数", type: "radio", opts: ["2027年から始める", "1〜2年", "3〜5年", "6〜9年", "10年以上", "その他"], req: true },
  { id: "style", sec: "2. 農業経験について", label: "現在のお米作りのスタイル（あてはまるもの全て）", type: "check", opts: ["専業農家として栽培", "兼業農家として栽培", "自家用を中心に栽培", "田んぼを借りて自分たちで栽培", "地域・団体・コミュニティとして栽培", "農家さんのお手伝いをしながら学んでいる", "誰もお米作りを行っていない（休田・耕作放棄地など）", "その他"], req: true },
  { id: "support", sec: "2. 農業経験について", label: "栽培をサポートしてくれる方はいますか？", type: "radio", opts: ["自分自身が栽培・作業判断を行う", "農家さんなど経験者から指導を受ける", "地域の農家さんと一緒に栽培する", "メンバー間で相談しながら栽培する", "その他"], req: true },
  { id: "tasks", sec: "3. 受け入れスタイル", label: "米部メンバーに参加してもらいたい作業", type: "check", opts: ["種まき・育苗", "田植え", "草刈り・草取り", "稲刈り", "はざ掛け", "脱穀", "その他"], req: true },
  { id: "busy", sec: "3. 受け入れスタイル", label: "繁忙期・特に力を貸してほしい作業と時期", type: "textarea", req: true, desc: "【例】①田植え（5月）・稲刈り（9月）。日常的な管理は農家さんが行うので、田植えと稲刈りのときに一緒に作業していただけたら十分です。 ②6〜8月の草取りを特にお願いします！田植え・稲刈りだけでなく、夏場の管理に継続して関わってくださる方を特に募集しています。" },
  { id: "welcome", sec: "3. 受け入れスタイル", label: "どんな関わり方を受け入れたいですか？（3つまで）", type: "check", max: 3, opts: ["農家さんのお手伝いをしたい", "お米づくりを学びたい", "年間を通して継続的に関わりたい", "作業を覚えて徐々に主体的に動きたい", "親子で田んぼに関わりたい", "地域や仲間との交流を楽しみたい", "イベントや企画にも関わりたい", "田んぼの運営そのものにも関わりたい", "スポットで無理なく関わりたい"], req: true },
  { id: "mismatch", sec: "3. 受け入れスタイル", label: "活動スタイルとして合わないもの", type: "check", opts: ["年1〜2回程度しか参加できない", "田植え・稲刈りなどの体験だけを希望", "継続的な参加が難しい", "農作業より交流・レジャーを主目的としている", "親子体験を主目的としている", "事前学習が難しい", "一から農作業を教えてもらうことを期待している", "主体的に作業することが難しい", "特に人手が必要な時期への参加が難しい", "直前にならないと参加可否を決められない", "連絡確認が頻繁にはできない", "特になし。さまざまな関わり方を歓迎", "その他"], req: true },
  { id: "beginner", sec: "3. 受け入れスタイル", label: "初心者受け入れのスタンス", type: "radio", opts: ["初心者大歓迎。作業も一緒に覚えていきましょう", "初心者OK。事前学習をして参加してください", "最初は説明しますが、徐々に自分で動けることを期待します", "ある程度農作業経験のある方を希望します", "即戦力として作業できる方を中心に募集したい", "その他"], req: true },
  { id: "fee_style", sec: "4. 費用や特典について", label: "運営方法", type: "check", opts: ["参加費等は設けず、お手伝いを中心に活動する", "参加日ごとに必要な実費を参加者で負担する", "年間活動費・年会費を募って運営する", "参加者みんなで田んぼの運営費を出し合う", "参加費等を募り、収穫したお米を参加者に分配する", "オーナー制度・共同オーナーのような形で運営する", "イベント・体験会ごとに単発で参加費を設定する", "その他"], req: true },
  { id: "fee_detail", sec: "4. 費用や特典について", label: "費用がある場合、金額・支払い時期・必須／任意と、何に使用するのかをご記入ください", type: "textarea", req: false, desc: "参加者との認識の違いを防ぐため、現時点で分かる範囲で具体的に。（例）年間活動費：10,000円／必須／4月支払い。苗代・肥料・機械使用料など、田んぼの年間運営費として使用します。収穫後、参加者へ○kgずつお米を分配予定。" },
  { id: "benefit", sec: "4. 費用や特典について", label: "参加者への特典・お礼はありますか？", type: "radio", opts: ["特になし", "ある", "現在検討中"], req: true },
  { id: "benefit_detail", sec: "4. 費用や特典について", label: "特典の内容（ある場合）", type: "check", opts: ["収穫したお米のプレゼント", "お米を参加者向けの特別価格で販売", "お米以外の農産物・加工品のプレゼント", "農産物等を参加者向け価格で販売", "イベント・交流会等への優待", "その他"], req: false, desc: "特典は必須ではありません。「特典なし」でも問題ありません。" },
  { id: "benefit_cond", sec: "4. 費用や特典について", label: "特典を受けられる条件（あれば具体的に）", type: "textarea", req: false, desc: "（例）条件：年会費10,000円支払い、年3回以上活動に参加した方／販売価格：＿円/kg（通常価格：＿円）／購入可能量：1世帯＿kgまで／購入可能時期／送料：込み・別途・手渡しのみ／不作等の場合：特典内容が変更・中止になる可能性 あり・なし" },
  { id: "niiname", sec: "4. 費用や特典について", label: "新嘗祭のお米お裾分けへの協力", type: "radio", opts: ["趣旨に賛同し、協力できます", "その年の収穫状況や参加状況を見て判断したい", "協力は難しい"], req: true, desc: "可能な田んぼには、新嘗祭の際に実際に活動に参加したメンバーへ、一人あたり『お結び1個分程度』の新米をお裾分けいただくことにご協力をお願いしています。" },
  { id: "share", sec: "5. 分かち合えること", label: "参加者と分かち合えること（3つまで）", type: "check", max: 3, desc: "特別なイベントやサービスを用意していただく必要はありません。お米づくりの知恵、田んぼの生きもの、地域の文化、農家さんとの会話など、普段の活動の中にあることも、この田んぼならではの大切な魅力です。", opts: ["お米ができるまでの一連の流れを知ることができる", "実際の農作業を経験できる", "お米づくりの知識や技術を学べる", "栽培方法や農法について学べる", "農家の仕事や暮らしについて知ることができる", "農業が抱えている課題や現状について知ることができる", "田んぼの生態系や生きものについて学べる", "自然や季節の変化を感じられる", "土や水、環境について学べる", "地域の文化や歴史に触れられる", "地域の方々と交流できる", "子どもと一緒に田んぼや自然に触れられる", "農家さんや仲間と食卓を囲む機会がある", "収穫したものを一緒に味わう機会がある", "仲間と協力して一つのものを育てる経験ができる", "田んぼの運営や企画にも関われる"], req: true },
  { id: "difficult", sec: "5. 分かち合えること", label: "参加者対応で難しいこと", type: "check", opts: ["お米作りを一から丁寧に教えること", "初心者への作業説明", "子ども向けの農業体験を提供すること", "毎回参加者について作業すること", "ワークショップやイベントを企画・開催すること", "食事や交流会などの参加", "個別の参加希望に対応すること", "特になし", "その他"], req: true },
  { id: "relation", sec: "6. 参加者との関係づくり", label: "参加者との関係づくりのスタイル", type: "radio", desc: "米部では、田んぼでの作業だけでなく、農家さんと参加者がお互いを知りながら、少しずつ関係性を育んでいくことを大切にしています。", opts: ["作業を通して関われれば十分", "必要な情報共有や会話には参加したい", "参加者との関係づくりにも積極的に関わりたい", "一緒にチーム・コミュニティを育てたい", "その他"], req: true },
  { id: "agree", sec: "7. セカイムラ米部についての理解確認", label: "上記を理解した上で田んぼ登録を希望しますか？", type: "radio", desc: "セカイムラ米部は、農家さんと『農業やお米づくりに関わりたい・応援したい』と思う人が出会うきっかけをつくる活動です。", opts: ["はい、登録します"], req: true },
  { id: "feeling", sec: "7. セカイムラ米部についての理解確認", label: "現在のお気持ち", type: "radio", opts: ["ぜひ一緒に活動したい", "楽しみだが、少し不安もある", "事前に事務局に相談したいことがある", "もう少し検討したい"], req: true },
];

const TYPE_LABELS: Array<[Q["type"], string]> = [
  ["text", "記述式（1行）"],
  ["textarea", "記述式（長文）"],
  ["radio", "1つ選ぶ"],
  ["check", "複数選べる"],
  ["select", "プルダウン"],
];

/** 米部ヒアリングシート — 農家さん向け。事務局は画面上で質問を修正できる。 */
export default function KomeHearingPage() {
  const [me, setMe] = useState<User | null>(null);
  const [amAdmin, setAmAdmin] = useState(false);
  const [qs, setQs] = useState<Q[]>(DEFAULT_QUESTIONS);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ans, setAns] = useState<Record<string, string | string[]>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  // 編集モード(事務局)
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Q[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(u.id).then(setAmAdmin)).catch(() => {});
    });
    supabase.from("kome_hearing_config").select("questions").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.questions && Array.isArray(data.questions) && data.questions.length) setQs(data.questions as Q[]);
    });
  }, []);

  const setV = (id: string, v: string) => setAns((a) => ({ ...a, [id]: v }));
  const toggleC = (q: Q, v: string) => setAns((a) => {
    const cur = (a[q.id] as string[]) ?? [];
    if (cur.includes(v)) return { ...a, [q.id]: cur.filter((x) => x !== v) };
    if (q.max && cur.length >= q.max) { alert(`${q.max}つまで選べます`); return a; }
    return { ...a, [q.id]: [...cur, v] };
  });

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) { alert("オーナー名・電話番号・メールアドレスは必須です"); return; }
    const missing = qs.filter((q) => q.req && (!ans[q.id] || (Array.isArray(ans[q.id]) && (ans[q.id] as string[]).length === 0)));
    if (missing.length) { alert(`未回答の必須項目があります: ${missing[0].label}`); return; }
    if (sending) return;
    setSending(true);
    // 回答は「質問文」をキーに保存(質問が後で変わっても回答が読める)
    const labeled: Record<string, string | string[]> = {};
    for (const q of qs) if (ans[q.id] !== undefined && ans[q.id] !== "") labeled[q.label] = ans[q.id];
    const { error } = await createClient().from("kome_hearing").insert({
      user_id: me?.id ?? null, name: name.trim(), phone: phone.trim(), email: email.trim(), answers: labeled,
    });
    setSending(false);
    if (error) { alert("送信できませんでした。もう一度お試しください"); return; }
    setDone(true);
    window.scrollTo(0, 0);
  };

  /* ── 編集モード(事務局) ── */
  const startEdit = () => { setDraft(qs.map((q) => ({ ...q, opts: q.opts ? [...q.opts] : undefined }))); setEditMode(true); window.scrollTo(0, 0); };
  const updQ = (i: number, patch: Partial<Q>) => setDraft((d) => d.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, dir: -1 | 1) => setDraft((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.length) return d;
    const nd = [...d]; [nd[i], nd[j]] = [nd[j], nd[i]]; return nd;
  });
  const delQ = (i: number) => { if (!confirm("この質問を削除しますか？")) return; setDraft((d) => d.filter((_, j) => j !== i)); };
  const addQ = (i: number) => setDraft((d) => {
    const nq: Q = { id: `q_${Date.now()}`, sec: d[i]?.sec ?? "新しいセクション", label: "新しい質問", type: "text", req: false };
    const nd = [...d]; nd.splice(i + 1, 0, nq); return nd;
  });
  const saveCfg = async () => {
    const bad = draft.find((q) => !q.label.trim());
    if (bad) { alert("質問文が空の項目があります"); return; }
    if (savingCfg) return;
    setSavingCfg(true);
    const clean = draft.map((q) => ({ ...q, opts: (q.type === "radio" || q.type === "check" || q.type === "select") ? (q.opts ?? []).filter((o) => o.trim()) : undefined }));
    const { error } = await createClient().from("kome_hearing_config").upsert({ id: 1, questions: clean, updated_by: me?.id ?? null, updated_at: new Date().toISOString() });
    setSavingCfg(false);
    if (error) { alert("保存できませんでした: " + error.message); return; }
    setQs(clean as Q[]);
    setEditMode(false);
    alert("ヒアリングシートを更新しました。このページを開いた全員に即反映されます🌾");
  };

  if (done)
    return (
      <main className="mx-auto min-h-dvh max-w-md px-5 pt-24 text-center" style={{ background: "#f6faf4" }}>
        <div className="text-[44px]">🌾</div>
        <h1 className="mt-3 text-[18px] font-extrabold text-[#2a3a28]">ご回答ありがとうございました</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#5a6a54]">事務局が内容を確認し、メールでご連絡いたします。</p>
        <Link href="/sekai/kome" className="mt-6 inline-block rounded-xl px-6 py-3 text-[13.5px] font-extrabold text-white no-underline" style={{ background: G }}>米部トップへ</Link>
      </main>
    );

  /* ══ 事務局の編集モード ══ */
  if (editMode)
    return (
      <main className="mx-auto min-h-dvh max-w-md pb-28" style={{ background: "#f7f4ec" }}>
        <header className="sticky top-0 z-40 px-4 pb-3 pt-4" style={{ background: "#1a2432" }}>
          <div className="text-[15px] font-bold text-[#f0e6c8]">ヒアリングシートを修正（事務局）</div>
          <div className="mt-0.5 text-[10px] text-[#7a9ab4]">保存すると即座に本番の質問が入れ替わります。アドレスは変わりません</div>
        </header>
        <div className="space-y-3 px-3 pt-3">
          {draft.map((q, i) => (
            <div key={q.id} className="rounded-xl bg-white p-3" style={{ border: "1px solid #e5dcc8" }}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="num text-[11px] font-bold text-[#a09a88]">Q{i + 1}</span>
                <input value={q.sec} onChange={(e) => updQ(i, { sec: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-[#eee8d8] bg-[#faf8f0] px-2 py-1 text-[11px] font-bold text-[#8a7020] outline-none" />
                <button onClick={() => moveQ(i, -1)} className="h-7 w-7 rounded-lg bg-[#f0ece0] text-[12px]">↑</button>
                <button onClick={() => moveQ(i, 1)} className="h-7 w-7 rounded-lg bg-[#f0ece0] text-[12px]">↓</button>
                <button onClick={() => delQ(i)} className="h-7 w-7 rounded-lg bg-[#f8e8e4] text-[12px] text-[#c05a3a]">🗑</button>
              </div>
              <textarea value={q.label} onChange={(e) => updQ(i, { label: e.target.value })} rows={2} placeholder="質問文" className="mb-1.5 w-full resize-y rounded-lg border border-[#e5dcc8] px-2.5 py-1.5 text-[13px] font-bold outline-none" />
              <textarea value={q.desc ?? ""} onChange={(e) => updQ(i, { desc: e.target.value || undefined })} rows={2} placeholder="説明・注意書き（任意）" className="mb-1.5 w-full resize-y rounded-lg border border-[#eee8d8] px-2.5 py-1.5 text-[11.5px] outline-none" />
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <select value={q.type} onChange={(e) => { const t = e.target.value as Q["type"]; updQ(i, { type: t, opts: (t === "radio" || t === "check" || t === "select") ? (q.opts ?? ["選択肢1", "選択肢2"]) : undefined }); }} className="rounded-lg border border-[#e5dcc8] bg-white px-2 py-1.5 text-[12px] outline-none">
                  {TYPE_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[12px] font-bold text-[#5a5448]">
                  <input type="checkbox" checked={q.req} onChange={(e) => updQ(i, { req: e.target.checked })} className="accent-[#c05a3a]" /> 必須
                </label>
                {q.type === "check" && (
                  <label className="flex items-center gap-1 text-[11.5px] text-[#5a5448]">
                    選択上限
                    <input type="number" min={0} value={q.max ?? ""} onChange={(e) => updQ(i, { max: e.target.value ? Number(e.target.value) : undefined })} placeholder="なし" className="w-14 rounded-lg border border-[#e5dcc8] px-1.5 py-1 text-[12px] outline-none" />
                  </label>
                )}
                {q.type === "text" && (
                  <input value={q.ph ?? ""} onChange={(e) => updQ(i, { ph: e.target.value || undefined })} placeholder="記入例(薄字で表示)" className="min-w-0 flex-1 rounded-lg border border-[#eee8d8] px-2 py-1.5 text-[11.5px] outline-none" />
                )}
              </div>
              {(q.type === "radio" || q.type === "check" || q.type === "select") && (
                <textarea
                  value={(q.opts ?? []).join("\n")}
                  onChange={(e) => updQ(i, { opts: e.target.value.split("\n") })}
                  rows={Math.min(8, Math.max(3, (q.opts ?? []).length))}
                  placeholder={"選択肢を1行に1つずつ"}
                  className="w-full resize-y rounded-lg border border-[#e5dcc8] bg-[#fdfcf8] px-2.5 py-1.5 text-[12px] leading-relaxed outline-none"
                />
              )}
              <button onClick={() => addQ(i)} className="mt-1.5 text-[11.5px] font-bold text-[#8a7020]">＋ この下に質問を追加</button>
            </div>
          ))}
        </div>
        <div className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 gap-2 px-3 py-3" style={{ background: "linear-gradient(transparent, #f7f4ec 30%)" }}>
          <button onClick={() => { if (confirm("編集を破棄しますか？")) setEditMode(false); }} className="rounded-xl bg-white px-4 py-3 text-[13px] font-bold text-[#a09a88]" style={{ border: "1px solid #e5dcc8" }}>やめる</button>
          <button onClick={saveCfg} disabled={savingCfg} className="flex-1 rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40" style={{ background: G }}>{savingCfg ? "保存中..." : "✓ この内容で本番に反映する"}</button>
        </div>
      </main>
    );

  /* ══ 通常の回答モード ══ */
  const sections = [...new Set(qs.map((q) => q.sec))];
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-24" style={{ background: "#f6faf4" }}>
      <IosBackButton />
      <header className="px-5 pb-4 pt-6 text-center" style={{ background: "linear-gradient(160deg,#7ab86a,#2a7a48)" }}>
        <div className="text-[11px] tracking-[2px] text-[#e0f0d8]">セカイムラ米部</div>
        <h1 className="mt-1 text-[18px] font-extrabold text-white">田んぼ登録 ヒアリングシート</h1>
        <p className="mx-auto mt-2 max-w-[330px] text-[11.5px] leading-relaxed text-[#e8f4e0]">
          お米作りは、一人ではできない仕事。でも、そこに共に汗を流す仲間がいれば、大変さの中にも喜びや笑いが生まれます。セカイムラ米部は農業支援者と農家をつなぐ、出会いのきっかけを提供する活動です。
        </p>
      </header>

      {amAdmin && (
        <div className="px-4 pt-3">
          <button onClick={startEdit} className="w-full rounded-xl border-2 border-dashed py-2.5 text-[12.5px] font-extrabold" style={{ borderColor: "#a08a3066", color: "#8a7020" }}>
            ヒアリングシートページを修正する（事務局）
          </button>
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        <section className="rounded-2xl bg-white p-3.5" style={{ border: "1px solid #d8e8d0" }}>
          <div className="mb-2 text-[13px] font-extrabold" style={{ color: G }}>お名前とご連絡先</div>
          <div className="mb-1 text-[11px] font-bold text-[#8aa088]">田んぼのオーナー名（必須）</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mb-2 w-full rounded-xl border border-[#d8e8d0] bg-white px-3 py-2.5 text-[13.5px] outline-none" />
          <div className="mb-1 text-[11px] font-bold text-[#8aa088]">電話番号（必須）</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="mb-2 w-full rounded-xl border border-[#d8e8d0] bg-white px-3 py-2.5 text-[13.5px] outline-none" />
          <div className="mb-1 text-[11px] font-bold text-[#8aa088]">メールアドレス（必須）</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-xl border border-[#d8e8d0] bg-white px-3 py-2.5 text-[13.5px] outline-none" />
        </section>

        {sections.map((sec) => (
          <section key={sec} className="rounded-2xl bg-white p-3.5" style={{ border: "1px solid #d8e8d0" }}>
            <div className="mb-2.5 text-[13px] font-extrabold" style={{ color: G }}>{sec}</div>
            <div className="space-y-3.5">
              {qs.filter((q) => q.sec === sec).map((q) => (
                <div key={q.id}>
                  <div className="mb-1 text-[12.5px] font-bold leading-snug text-[#2a3a28]">
                    {q.label}{q.req && <span className="ml-1 text-[10px] font-extrabold text-[#c05a3a]">必須</span>}
                  </div>
                  {q.desc && <p className="mb-1.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-[#8aa088]">{q.desc}</p>}
                  {q.type === "text" && <input value={(ans[q.id] as string) ?? ""} onChange={(e) => setV(q.id, e.target.value)} placeholder={q.ph} className="w-full rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] outline-none" />}
                  {q.type === "textarea" && <textarea value={(ans[q.id] as string) ?? ""} onChange={(e) => setV(q.id, e.target.value)} placeholder={q.ph} rows={3} className="w-full resize-y rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] outline-none" />}
                  {q.type === "select" && (
                    <select value={(ans[q.id] as string) ?? ""} onChange={(e) => setV(q.id, e.target.value)} className="w-full rounded-xl border border-[#d8e8d0] bg-white px-2 py-2 text-[13px] outline-none">
                      <option value="">選んでください</option>
                      {(q.opts ?? []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                  {q.type === "radio" && (
                    <div className="space-y-1">
                      {(q.opts ?? []).map((o) => (
                        <label key={o} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-0.5 text-[12.5px] leading-snug text-[#3a4a34]">
                          <input type="radio" name={q.id} checked={ans[q.id] === o} onChange={() => setV(q.id, o)} className="mt-0.5 accent-[#2a7a48]" />
                          {o}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "check" && (
                    <div className="space-y-1">
                      {(q.opts ?? []).map((o) => (
                        <label key={o} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-0.5 text-[12.5px] leading-snug text-[#3a4a34]">
                          <input type="checkbox" checked={((ans[q.id] as string[]) ?? []).includes(o)} onChange={() => toggleC(q, o)} className="mt-0.5 accent-[#2a7a48]" />
                          {o}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <button onClick={submit} disabled={sending} className="w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40" style={{ background: G }}>
          {sending ? "送信中..." : "🌾 この内容で送信する"}
        </button>
      </div>
    </main>
  );
}
