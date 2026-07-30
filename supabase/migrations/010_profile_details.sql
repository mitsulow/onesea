-- 詳細プロフィール（楽市楽座のマイページ相当）
alter table public.profiles add column if not exists status_line text;
alter table public.profiles add column if not exists prefecture text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists rice_work text;
alter table public.profiles add column if not exists life_work text;
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists wants_to_do text[] not null default '{}';
alter table public.profiles add column if not exists sns jsonb;
