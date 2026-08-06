/** プライバシーポリシー（Google OAuth検証・アプリストア審査用） */
export const metadata = { title: "プライバシーポリシー — OneSea" };

const S = "mt-6 text-[15px] font-extrabold text-[#2a2622]";
const P = "mt-2 text-[13px] leading-relaxed text-[#5a5448]";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <h1 className="text-[20px] font-extrabold text-[#2a2622]">プライバシーポリシー</h1>
      <p className={P}>
        株式会社人の手デザイン（以下「当社」）は、無料アプリ「OneSea」（https://onesea.vercel.app、以下「本サービス」）における利用者の情報を、次のとおり取り扱います。
      </p>

      <h2 className={S}>1. 取得する情報</h2>
      <p className={P}>
        ・Googleアカウントでのログイン時: 氏名、メールアドレス、プロフィール画像（Googleカレンダー・Gmail等の中身にはアクセスしません）
        <br />・利用者が任意で登録する情報: ニックネーム、誕生日・誕生時刻・出生地、お住まいの地域、DDP（願い）、投稿・コメント・画像
        <br />・位置情報: 潮汐表示・地球儀表示のため端末内で利用します（許可制・拒否しても利用できます）
        <br />・手帳の予定・メモ: 利用者の端末内（ブラウザのローカルストレージ）にのみ保存され、当社のサーバーには送信されません
      </p>

      <h2 className={S}>2. 利用目的</h2>
      <p className={P}>
        本サービスの提供・本人確認・会員区分の管理、暦や占いなどのパーソナライズ表示、会の運営連絡、不正利用の防止のために利用します。
      </p>

      <h2 className={S}>3. 第三者提供・委託</h2>
      <p className={P}>
        法令に基づく場合を除き、本人の同意なく第三者へ提供しません。データの保管には Supabase・Vercel・Cloudflare
        などのクラウド基盤を利用しています（各社のセキュリティ基準のもとで保管されます）。
      </p>

      <h2 className={S}>4. 公開範囲</h2>
      <p className={P}>
        投稿（CotoZute等）・マイページの公開項目は他の利用者に表示されます。携帯番号・お住まいの市町村・誕生情報などの非公開項目は、他の利用者には表示されません。
      </p>

      <h2 className={S}>5. 削除・お問い合わせ</h2>
      <p className={P}>
        アカウントおよび登録情報の削除を希望される場合は、下記までご連絡ください。確認のうえ速やかに対応します。
        <br />
        連絡先: mitsulow@gmail.com（株式会社人の手デザイン）
      </p>

      <p className="mt-8 text-[11px] text-[#a09888]">制定日: 2026年8月6日</p>
      <a href="/" className="mt-6 inline-block text-[12px] font-bold text-[#2CB7DE] no-underline">
        ← OneSeaにもどる
      </a>
    </main>
  );
}
