-- MMM ニューラ活動: 同じ市町村の5人1チーム。冬至までに互いのDDPを叶え合う
create table public.neura_teams (
  id uuid primary key default gen_random_uuid(),
  prefecture text not null,
  city text,
  season text not null default '2026冬至',
  created_at timestamptz not null default now()
);
alter table public.neura_teams enable row level security;
create policy "nt_select_all" on public.neura_teams for select using (true);
create policy "nt_insert_auth" on public.neura_teams for insert with check (auth.uid() is not null);

create table public.neura_members (
  team_id uuid not null references public.neura_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
alter table public.neura_members enable row level security;
create policy "nm_select_all" on public.neura_members for select using (true);
create policy "nm_insert_own" on public.neura_members for insert with check (auth.uid() = user_id);
create policy "nm_delete_own" on public.neura_members for delete using (auth.uid() = user_id);

-- チームのDDPをお互いに見られるように（書き込みは従来通り本人のみ）
create policy "ddp_select_all" on public.ddp for select using (true);

-- グループLINEに「ニューラ班」スコープを追加
alter table public.group_messages drop constraint group_messages_scope_type_check;
alter table public.group_messages add constraint group_messages_scope_type_check
  check (scope_type in ('village', 'club', 'neura'));

drop policy "gm_select_member" on public.group_messages;
create policy "gm_select_member" on public.group_messages for select using (
  (scope_type = 'village' and exists (
    select 1 from public.village_members vm where vm.village_id = scope_id and vm.user_id = auth.uid()))
  or (scope_type = 'club' and exists (
    select 1 from public.club_members cm where cm.club_id = scope_id and cm.user_id = auth.uid()))
  or (scope_type = 'neura' and exists (
    select 1 from public.neura_members nm where nm.team_id = scope_id and nm.user_id = auth.uid()))
);
drop policy "gm_insert_member" on public.group_messages;
create policy "gm_insert_member" on public.group_messages for insert with check (
  sender_id = auth.uid() and (
    (scope_type = 'village' and exists (
      select 1 from public.village_members vm where vm.village_id = scope_id and vm.user_id = auth.uid()))
    or (scope_type = 'club' and exists (
      select 1 from public.club_members cm where cm.club_id = scope_id and cm.user_id = auth.uid()))
    or (scope_type = 'neura' and exists (
      select 1 from public.neura_members nm where nm.team_id = scope_id and nm.user_id = auth.uid()))
  )
);
