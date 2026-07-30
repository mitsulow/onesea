-- 初回登録フロー: 携帯番号 + 登録完了フラグ
alter table public.private_profiles add column if not exists phone text;
alter table public.profiles add column if not exists onboarded_at timestamptz;
