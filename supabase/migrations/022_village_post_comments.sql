-- 各県のセカイムラ情報（村の活動報告）へのコメント
create table public.village_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.village_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.village_post_comments enable row level security;
create policy "vpc_select_all" on public.village_post_comments for select using (true);
create policy "vpc_insert_own" on public.village_post_comments for insert with check (auth.uid() = user_id);
create policy "vpc_delete_own" on public.village_post_comments for delete using (auth.uid() = user_id);
create index vpc_post_idx on public.village_post_comments (post_id, created_at);
