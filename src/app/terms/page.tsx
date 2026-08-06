/** 利用規約（Google OAuth検証・アプリストア審査用） */
export const metadata = { title: "利用規約 — OneSea" };

const S = "mt-6 text-[15px] font-extrabold text-[#2a2622]";
const P = "mt-2 text-[13px] leading-relaxed text-[#5a5448]";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <h1 className="text-[20px] font-extrabold text-[#2a2622]">利用規約</h1>
      <p className={P}>
        この規約は、株式会社人の手デザイン（以下「当社」）が提供する「OneSea」（以下「本サービス」）の利用条件を定めるものです。利用者は、本サービスを利用することで本規約に同意したものとみなします。
      </p>

      <h2 className={S}>1. サービス内容</h2>
      <p className={P}>
        本サービスは、手帳・暦・シューマン共振の表示・投稿（CotoZute）・マーケット（楽市楽座）・コミュニティ（セカイムラ／MMM）等を提供します。無料で利用できる範囲と、有料会員（わらわ〜会員）だけが利用できる範囲があります。
      </p>

      <h2 className={S}>2. 禁止事項</h2>
      <p className={P}>
        法令または公序良俗に反する行為、他の利用者への誹謗中傷・嫌がらせ、なりすまし、虚偽情報の登録、本サービスの運営を妨げる行為、その他当社が不適切と判断する行為を禁止します。違反があった場合、投稿の削除や利用停止を行うことがあります。
      </p>

      <h2 className={S}>3. 免責</h2>
      <p className={P}>
        暦・潮汐・シューマン共振・占い等の表示は情報提供であり、正確性・完全性を保証するものではありません。健康・医療上の効果を保証するものでもありません。利用者間の取引・交流について、当社は当事者間で解決いただくことを原則とします。
      </p>

      <h2 className={S}>4. 料金</h2>
      <p className={P}>
        有料会員の料金・特典は申込画面に表示するとおりとします。決済後の返金は、法令に定めがある場合を除き行いません。
      </p>

      <h2 className={S}>5. 規約の変更</h2>
      <p className={P}>
        当社は必要に応じて本規約を変更できます。重要な変更は本サービス上でお知らせします。
      </p>

      <p className="mt-8 text-[11px] text-[#a09888]">制定日: 2026年8月6日 ・ 連絡先: mitsulow@gmail.com</p>
      <a href="/" className="mt-6 inline-block text-[12px] font-bold text-[#2CB7DE] no-underline">
        ← OneSeaにもどる
      </a>
    </main>
  );
}
