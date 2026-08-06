import Link from "next/link";

/**
 * 各サービスの料金＋紹介ページ(LP)への導線バナー。
 * 「詳しく見る」で各サービスLPへ → LPの入会ボタンからOneSeaキャンペーン(模擬決済)へ集約。
 */
export function PriceBanner({
  service,
  price,
  lp,
  color = "#c8a030",
}: {
  service: string;
  price: string;
  lp: string; // 例: /lp/tsukiyoga
  color?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2"
      style={{ background: "rgba(0,0,0,.25)", borderBottom: `1px solid ${color}44` }}
    >
      <span className="text-[11.5px] font-bold text-white/85">
        {service} <span className="num ml-1 font-extrabold" style={{ color }}>{price}</span>
      </span>
      <Link
        href={lp}
        className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#1a1a24] no-underline"
        style={{ background: color }}
      >
        詳しく見る
      </Link>
    </div>
  );
}
