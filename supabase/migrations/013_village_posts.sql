-- 村の囲炉裏（拠点ごとの掲示板）
create table public.village_posts (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.village_posts enable row level security;
create policy "vp_select_all" on public.village_posts for select using (true);
create policy "vp_insert_own" on public.village_posts for insert with check (auth.uid() = user_id);
create policy "vp_delete_own" on public.village_posts for delete using (auth.uid() = user_id);
create index vp_village_idx on public.village_posts (village_id, created_at desc);
