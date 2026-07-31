-- グループLINE: 村(village)・部活(club)ごとのトークルーム
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('village', 'club')),
  scope_id uuid not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index gm_scope_idx on public.group_messages (scope_type, scope_id, created_at);
alter table public.group_messages enable row level security;

create policy "gm_select_member" on public.group_messages for select using (
  (scope_type = 'village' and exists (
    select 1 from public.village_members vm where vm.village_id = scope_id and vm.user_id = auth.uid()))
  or
  (scope_type = 'club' and exists (
    select 1 from public.club_members cm where cm.club_id = scope_id and cm.user_id = auth.uid()))
);
create policy "gm_insert_member" on public.group_messages for insert with check (
  sender_id = auth.uid() and (
    (scope_type = 'village' and exists (
      select 1 from public.village_members vm where vm.village_id = scope_id and vm.user_id = auth.uid()))
    or
    (scope_type = 'club' and exists (
      select 1 from public.club_members cm where cm.club_id = scope_id and cm.user_id = auth.uid()))
  )
);
create policy "gm_delete_own" on public.group_messages for delete using (auth.uid() = sender_id);

-- 既読位置（グループはメッセージ単位でなく最終既読時刻で管理）
create table public.group_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null,
  scope_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, scope_type, scope_id)
);
alter table public.group_reads enable row level security;
create policy "gr_own" on public.group_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
