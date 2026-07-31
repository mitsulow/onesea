-- 楽市（0円・物々交換）と楽座（有料・プロの商品）の区分 + 商品コメント欄
alter table public.shops
  add column market text not null default 'za' check (market in ('ichi', 'za'));
update public.shops set market = 'ichi' where is_trial = true or price_jpy = 0;

create table public.shop_comments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.shop_comments enable row level security;
create policy "sc_select_all" on public.shop_comments for select using (true);
create policy "sc_insert_own" on public.shop_comments for insert with check (auth.uid() = user_id);
create policy "sc_delete_own" on public.shop_comments for delete using (auth.uid() = user_id);
create index sc_shop_idx on public.shop_comments (shop_id, created_at);
