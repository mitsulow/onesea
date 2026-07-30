-- OTOHIKARI 再生ログ（本番カウント用）
-- 個別行は非公開（select ポリシーなし）。集計は security definer RPC のみ公開。

create table public.listens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.listens enable row level security;
create policy "listens_insert_own" on public.listens
  for insert with check (auth.uid() = user_id);

create or replace function public.today_listens()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from listens
  where created_at >= ((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo';
$$;
grant execute on function public.today_listens() to anon, authenticated;
