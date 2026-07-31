-- アイディアモードで降りてきた言葉（マイページの「アイディア一覧」）
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.ideas enable row level security;
create policy "ideas_own_select" on public.ideas for select using (auth.uid() = user_id);
create policy "ideas_own_insert" on public.ideas for insert with check (auth.uid() = user_id);
create policy "ideas_own_delete" on public.ideas for delete using (auth.uid() = user_id);
create index ideas_user_idx on public.ideas (user_id, created_at desc);
