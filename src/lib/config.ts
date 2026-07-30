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

/** Onesea 専用 Supabase プロジェクト（東京）。他サービスと認証を共有しない */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZ29mamt4cWd1emdycHRjaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE4ODEsImV4cCI6MjEwMDk4Nzg4MX0.RUJeAih2h08bfOPiM6DJfm-_cbTx3X4FCheJ8ZUJhKY";
