/** OneSea について（Google OAuth ブランディング検証のホームページ要件を満たす静的ページ） */
export const metadata = {
  title: "OneSea — すべての海は、ひとつ。",
  description:
    "OneSeaは、太陽と月と潮のリズムで生きるための無料の手帳アプリです。暦・潮汐・シューマン共振の表示、投稿コミュニティCotoZute、マーケット楽市楽座、セカイムラ、MMMをひとつにつなぎます。",
};

const S = "mt-7 text-[16px] font-extrabold text-[#2a2622]";
const P = "mt-2 text-[13.5px] leading-relaxed text-[#5a5448]";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-12">
      <h1 className="text-[28px] font-extrabold tracking-[2px] text-[#2a2622]">OneSea</h1>
      <p className="mt-1 text-[13px] tracking-[3px] text-[#8aa8bc]">すべての海は、ひとつ。</p>

      <p className={P + " mt-5"}>
        OneSea（ワンシー）は、太陽と月と潮のリズムで生きるための<b>無料の手帳アプリ</b>です。
        1年を360の「節分かれつ刻（フシワカレツトキ）」で刻む暦、お近くの港の潮汐、
        地球の鼓動シューマン共振の実測値を、毎日ひとつの画面でお届けします。
      </p>

      <h2 className={S}>OneSeaでできること</h2>
      <p className={P}>
        ・<b>願い叶い手帳</b> — 暦・月齢・潮汐と一体になった手帳。予定は端末の中にだけ保存されます
        <br />・<b>シューマン共振</b> — トムスク大学の実測データを5分刻みで。2011年からのアーカイブも
        <br />・<b>CotoZute</b> — 幸せの波紋を拡げる、ネガティブのない投稿コミュニティ
        <br />・<b>楽市楽座</b> — 0円出品・物々交換もできるマーケット
        <br />・<b>セカイムラ / MMM</b> — 全国の拠点・新月会満月会・音で繋がるコミュニティ
      </p>

      <h2 className={S}>Googleログインについて</h2>
      <p className={P}>
        会員登録にはGoogleアカウントを使用し、お名前・メールアドレス・プロフィール画像のみをお預かりします。
        Googleカレンダー・Gmail等の内容にはアクセスしません。詳しくは
        <a href="/privacy" className="mx-1 font-bold text-[#2CB7DE] no-underline">プライバシーポリシー</a>
        と
        <a href="/terms" className="mx-1 font-bold text-[#2CB7DE] no-underline">利用規約</a>
        をご覧ください。
      </p>

      <p className={P}>運営: 株式会社人の手デザイン ・ 連絡先: mitsulow@gmail.com</p>

      <a
        href="/"
        className="mt-8 inline-block rounded-2xl px-8 py-3.5 text-[14.5px] font-extrabold text-white no-underline"
        style={{ background: "linear-gradient(120deg,#2CB7DE,#1B8FB5)" }}
      >
        OneSeaをはじめる（無料）
      </a>
    </main>
  );
}
