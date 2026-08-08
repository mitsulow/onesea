/**
 * わらわ〜会員（プレミアム）の認証バッジ。X/Instagramの認証マークと同じ文法:
 * 名前の直後に置く小さな円+レ点。タイトル属性で「わらわ〜会員（認証済み）」。
 */
export function WarawaBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label="わらわ〜会員（認証済み）"
      className="inline-block flex-shrink-0 align-[-2px]"
    >
      <title>わらわ〜会員（認証済み）</title>
      {/* 波形の縁どり円（金） */}
      <path
        d="M10 0l2.4 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L20 10l-1.8 2.4.4 3-2.8 1.2-1.2 2.8-3-.4L10 20l-2.4-1.8-3 .4-1.2-2.8-2.8-1.2.4-3L0 10l1.8-2.4-.4-3 2.8-1.2L5.4 .6l3 .4z"
        fill="#2CB7DE"
      />
      <path d="M5.6 10.3l2.9 2.9 5.9-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


/** 公認セカイムラ拠点のしるし（緑のチェック）— 村名義の投稿に付く */
export function SekaiBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label="公認セカイムラ拠点"
      className="inline-block flex-shrink-0 align-[-2px]"
    >
      <title>公認セカイムラ拠点</title>
      <path
        d="M10 0l2.4 2.1 3.1-.5 1 3 3 1-.5 3.1L21 11l-2.1 2.4.5 3.1-3 1-1 3-3.1-.5L10 22l-2.4-2.1-3.1.5-1-3-3-1 .5-3.1L-1 11l2.1-2.4-.5-3.1 3-1 1-3 3.1.5z"
        transform="scale(0.9) translate(1,-0.5)"
        fill="#2a8a4a"
      />
      <path d="M6 10.2l2.6 2.6L14.2 7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
