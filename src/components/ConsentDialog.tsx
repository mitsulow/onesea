"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ConsentKind, giveConsent } from "@/lib/consents";

/**
 * 初回利用前の法的同意ダイアログ。
 * チェックボックスにチェックしないと「了承して利用開始」が押せない。
 */
const TEXTS: Record<
  ConsentKind,
  { title: string; body: string[]; check: string; start: string }
> = {
  techo: {
    title: "手帳をお使いになる前に",
    body: [
      "手帳の予定・メモはお使いの端末に保存されます。端末の故障・機種変更・ブラウザのデータ消去などにより、データが消えても運営は責任を取れません。",
      "大切な予定は、ご自身でメモ帳などにもバックアップされることをおすすめします。",
      "（わらわ〜会員は予定が自動でクラウドにバックアップされます）",
    ],
    check: "データが消える可能性があることを了承します",
    start: "了承して手帳を使いはじめる",
  },
  cotozute: {
    title: "Cotozuteに投稿する前に",
    body: [
      "Cotozuteは、政治的な意図や意見を主張する場ではなく、日々の生活の中の些細な幸せを周囲に伝えるSNSです。主張や意見の発信は、他のSNSをご活用ください。",
      "誹謗中傷・差別的表現・他者のプライバシーを侵害する書き込みがあった場合、投稿の削除やメンバー退会の措置を取ることがあります。",
      "投稿内容についての法的責任は投稿者ご本人に帰属します。著作権・肖像権にもご配慮ください。",
    ],
    check: "上記を了承します",
    start: "了承して利用開始",
  },
  za: {
    title: "楽市楽座に出店する前に",
    body: [
      "法律に違反するような商品・サービスの販売はできません。運営でもパトロールしますが、出店前にご自身でも法律のチェックをお願いします。",
      "例①：「近くまで車で送るので100円」→ 自家用車での有償送迎は白タク行為（道路運送法違反）",
      "例②：免許なくマッサージをしてお金を受け取る → あん摩マツサージ指圧師等法違反",
      "例③：自家製のお菓子・惣菜・飲料の販売 → 保健所の営業許可が必要（食品衛生法）",
      "例④：お酒の販売 → 酒類販売業免許が必要（酒税法）",
      "例⑤：「がんに効く」など効果効能をうたう健康品 → 薬機法違反のおそれ",
      "例⑥：中古品の継続的な売買 → 古物商許可が必要（古物営業法）／ブランド品の模倣は商標法違反",
      "違法なおそれのある出店は予告なく削除することがあります。",
    ],
    check: "法令違反の出店があった場合でも、運営側は責任を負わないことを了承します",
    start: "了承して出店にすすむ",
  },
};

export function ConsentDialog({
  kind,
  userId,
  onAgreed,
  onClose,
}: {
  kind: ConsentKind;
  userId: string;
  onAgreed: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = TEXTS[kind];
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[80dvh] w-full max-w-[360px] overflow-y-auto rounded-3xl bg-white p-5">
        <div className="text-[15px] font-extrabold text-[#3a3428]">{t.title}</div>
        <div className="mt-2.5 space-y-2">
          {t.body.map((line, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-[#5a5448]">
              {line}
            </p>
          ))}
        </div>
        <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#e8dcc4] bg-[#fffaf0] p-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#c94d3a]"
          />
          <span className="text-[12.5px] font-bold leading-snug text-[#3a3428]">{t.check}</span>
        </label>
        <button
          disabled={!checked || saving}
          onClick={async () => {
            setSaving(true);
            await giveConsent(userId, kind);
            setSaving(false);
            onAgreed();
          }}
          className="mt-3 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white disabled:opacity-35"
          style={{ background: "#c94d3a" }}
        >
          {saving ? "..." : t.start}
        </button>
        <button onClick={onClose} className="mt-2 block w-full text-center text-[11px] text-[#a09888]">
          やめておく
        </button>
      </div>
    </div>,
    document.body
  );
}
