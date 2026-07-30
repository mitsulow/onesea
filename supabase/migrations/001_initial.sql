-- Onesea 専用 DB 初期スキーマ（プロフィール / Cotozute / 手帳同期 / DDP）
-- 全テーブル RLS 必須（CLAUDE.md §2）

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts_select_all" on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);
create index posts_created_at_idx on public.posts (created_at desc);

-- 手帳のクラウド同期（メモ・時間別予定）
create table public.techo_entries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  note text,
  hours jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.techo_entries enable row level security;
create policy "techo_own" on public.techo_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DDP（端的な願い）
create table public.ddp (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  body text,
  updated_at timestamptz not null default now()
);
alter table public.ddp enable row level security;
create policy "ddp_own" on public.ddp
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
