/** 料金・特典・パラメータのハードコード禁止ルールにより設定値を集約 */
export const SCHUMANN = {
  /** 現行運用の基本周波数（Hz）。夏至バージョン 7.95Hz */
  hz: 7.95,
  /** 可聴域への逓倍数（7.83Hz × 64 = 501.12Hz が基準） */
  mult: 64,
  /** 無料試聴秒数（フェードアウト込み） */
  freeSec: 10,
  label: "夏至バージョン",
  length: "5:36",
} as const;

export const LINKS = {
  sekaimura: "https://sekaimura-gold.vercel.app",
  mmm: "https://mastermindmembers.net",
  tsukiyoga: "https://mitsulow.github.io/0Lei/tsukiyoga_v7.html",
  rakuza: "https://rakuza-ten.vercel.app",
  rakuzaMyPage: "https://rakuza-ten.vercel.app/my",
  rakuzaCotozute: "https://rakuza-ten.vercel.app/posts",
} as const;

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://upfoawnqjfprepanepqj.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZm9hd25xamZwcmVwYW5lcHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzU5NTksImV4cCI6MjA5MjI1MTk1OX0.X8sCtshUgyajijFDNIAVipI2ISnJ4eAX5PGw_sSGZtk";
