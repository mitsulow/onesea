-- 初回登録情報: 誕生日・誕生時刻・性別（ツキヨガ等で利用）
-- 高感度情報のため本人のみ読み書き可（DDP は既存 ddp テーブル・同じく本人のみ）

create table public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  birth_time time,
  gender text check (gender in ('female', 'male')),
  updated_at timestamptz not null default now()
);
alter table public.private_profiles enable row level security;
create policy "private_profiles_own" on public.private_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
