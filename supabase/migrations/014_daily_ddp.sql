-- 今日のDDP（シューマン瞑想後にふと浮かんだこと・日付ごとに積み重ねる）
create table public.daily_ddp (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_ddp enable row level security;
create policy "daily_ddp_select_all" on public.daily_ddp for select using (true);
create policy "daily_ddp_insert_own" on public.daily_ddp for insert with check (auth.uid() = user_id);
create policy "daily_ddp_update_own" on public.daily_ddp for update using (auth.uid() = user_id);
create policy "daily_ddp_delete_own" on public.daily_ddp for delete using (auth.uid() = user_id);

-- マスターDDP（名刺の一番上に載せるため公開読み取りを追加）
create policy "ddp_select_all" on public.ddp for select using (true);
