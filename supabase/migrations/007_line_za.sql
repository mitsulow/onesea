-- LINE（1対1メッセージ）と 楽座（マーケット）

-- ═══ LINE ═══
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.profiles(id) on delete cascade,
  b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chats_pair_unique unique (a, b),
  constraint chats_order check (a < b)
);
alter table public.chats enable row level security;
create policy "chats_participants" on public.chats
  for all using (auth.uid() = a or auth.uid() = b)
  with check (auth.uid() = a or auth.uid() = b);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "messages_select_participants" on public.messages
  for select using (exists (select 1 from chats c where c.id = chat_id and (auth.uid() = c.a or auth.uid() = c.b)));
create policy "messages_insert_sender" on public.messages
  for insert with check (auth.uid() = sender_id and exists (select 1 from chats c where c.id = chat_id and (auth.uid() = c.a or auth.uid() = c.b)));
create policy "messages_update_participants" on public.messages
  for update using (exists (select 1 from chats c where c.id = chat_id and (auth.uid() = c.a or auth.uid() = c.b)));
create index messages_chat_idx on public.messages (chat_id, created_at);

-- ═══ 楽座 ═══
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price_jpy integer,
  is_trial boolean not null default false,
  accepts_barter boolean not null default false,
  accepts_tip boolean not null default false,
  category text,
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.shops enable row level security;
create policy "shops_select_all" on public.shops for select using (true);
create policy "shops_insert_own" on public.shops for insert with check (auth.uid() = owner_id);
create policy "shops_update_own" on public.shops for update using (auth.uid() = owner_id);
create policy "shops_delete_own" on public.shops for delete using (auth.uid() = owner_id);
create index shops_created_idx on public.shops (created_at desc);

-- ═══ 画像ストレージ（クライアント圧縮した WebP のみを想定） ═══
insert into storage.buckets (id, name, public) values ('shop-images', 'shop-images', true)
on conflict (id) do nothing;
create policy "shop_images_read" on storage.objects
  for select using (bucket_id = 'shop-images');
create policy "shop_images_insert_auth" on storage.objects
  for insert with check (bucket_id = 'shop-images' and auth.role() = 'authenticated');
create policy "shop_images_delete_own" on storage.objects
  for delete using (bucket_id = 'shop-images' and owner = auth.uid());
