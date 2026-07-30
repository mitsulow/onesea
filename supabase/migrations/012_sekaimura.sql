-- セカイムラ本実装（インタビュー議事録 2026-07-27 準拠）
-- 地域=大きな箱（都道府県ラウンジ）/ 拠点=村（複数可・受入方針つき）/ 部活 / 米部 / 神社町 /
-- 百姓マイスター / 助けて掲示板 / 満月会・新月会の参加表明

-- 集い（満月会・新月会）の参加表明
create table public.moot_rsvps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  moot_date date not null,
  kind text not null check (kind in ('new', 'full')),
  created_at timestamptz not null default now(),
  primary key (user_id, moot_date)
);
alter table public.moot_rsvps enable row level security;
create policy "moot_select_all" on public.moot_rsvps for select using (true);
create policy "moot_insert_own" on public.moot_rsvps for insert with check (auth.uid() = user_id);
create policy "moot_delete_own" on public.moot_rsvps for delete using (auth.uid() = user_id);

-- 地域ラウンジ（都道府県ごとの大きな箱）への投稿
create table public.lounge_posts (
  id uuid primary key default gen_random_uuid(),
  prefecture text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.lounge_posts enable row level security;
create policy "lounge_select_all" on public.lounge_posts for select using (true);
create policy "lounge_insert_own" on public.lounge_posts for insert with check (auth.uid() = user_id);
create policy "lounge_delete_own" on public.lounge_posts for delete using (auth.uid() = user_id);
create index lounge_pref_idx on public.lounge_posts (prefecture, created_at desc);

-- 拠点（村）。一つの県に複数OK・受入方針は自治
create table public.villages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefecture text not null,
  description text,
  policy text not null default 'open' check (policy in ('open', 'approval', 'invite', 'paused', 'full')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.villages enable row level security;
create policy "villages_select_all" on public.villages for select using (true);
create policy "villages_insert_own" on public.villages for insert with check (auth.uid() = created_by);
create policy "villages_update_own" on public.villages for update using (auth.uid() = created_by);
create policy "villages_delete_own" on public.villages for delete using (auth.uid() = created_by);

create table public.village_members (
  village_id uuid not null references public.villages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (village_id, user_id)
);
alter table public.village_members enable row level security;
create policy "vm_select_all" on public.village_members for select using (true);
create policy "vm_insert_own" on public.village_members for insert with check (auth.uid() = user_id);
create policy "vm_delete_own" on public.village_members for delete using (auth.uid() = user_id);

-- 部活動（公式 + 自由。誰でも部長になれる）
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  description text,
  scope text not null default '全国',
  is_official boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
create policy "clubs_select_all" on public.clubs for select using (true);
create policy "clubs_insert_own" on public.clubs for insert with check (auth.uid() = created_by);
create policy "clubs_update_own" on public.clubs for update using (auth.uid() = created_by);
create policy "clubs_delete_own" on public.clubs for delete using (auth.uid() = created_by and is_official = false);

create table public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
alter table public.club_members enable row level security;
create policy "cm_select_all" on public.club_members for select using (true);
create policy "cm_insert_own" on public.club_members for insert with check (auth.uid() = user_id);
create policy "cm_delete_own" on public.club_members for delete using (auth.uid() = user_id);

create table public.club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.club_posts enable row level security;
create policy "cp_select_all" on public.club_posts for select using (true);
create policy "cp_insert_own" on public.club_posts for insert with check (auth.uid() = user_id);
create policy "cp_delete_own" on public.club_posts for delete using (auth.uid() = user_id);
create index cp_club_idx on public.club_posts (club_id, created_at desc);

-- 米部: 蘇らせた田んぼ台帳
create table public.tanbo (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefecture text not null,
  note text,
  photo_url text,
  year integer not null default 2026,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tanbo enable row level security;
create policy "tanbo_select_all" on public.tanbo for select using (true);
create policy "tanbo_insert_own" on public.tanbo for insert with check (auth.uid() = user_id);
create policy "tanbo_delete_own" on public.tanbo for delete using (auth.uid() = user_id);

-- 神社町: ミソカ（晦日）のそうじレポート
create table public.jinja_reports (
  id uuid primary key default gen_random_uuid(),
  shrine text not null,
  prefecture text,
  note text,
  photo_url text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.jinja_reports enable row level security;
create policy "jinja_select_all" on public.jinja_reports for select using (true);
create policy "jinja_insert_own" on public.jinja_reports for insert with check (auth.uid() = user_id);
create policy "jinja_delete_own" on public.jinja_reports for delete using (auth.uid() = user_id);

-- 百姓マイスター: 100の暮らしの技への「できる」「学びたい」
create table public.meister_marks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id integer not null,
  kind text not null check (kind in ('can', 'want')),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id, kind)
);
alter table public.meister_marks enable row level security;
create policy "mm_select_all" on public.meister_marks for select using (true);
create policy "mm_insert_own" on public.meister_marks for insert with check (auth.uid() = user_id);
create policy "mm_delete_own" on public.meister_marks for delete using (auth.uid() = user_id);

-- 助けて掲示板（相互扶助・非商業）
create table public.tasukete (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  prefecture text,
  reward text not null default '無償' check (reward in ('無償', '実費', '持ち寄り', '助け返し')),
  closed boolean not null default false,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tasukete enable row level security;
create policy "task_select_all" on public.tasukete for select using (true);
create policy "task_insert_own" on public.tasukete for insert with check (auth.uid() = user_id);
create policy "task_update_own" on public.tasukete for update using (auth.uid() = user_id);
create policy "task_delete_own" on public.tasukete for delete using (auth.uid() = user_id);

-- 運営設定（Zoom/YouTube のURLなど）
create table public.sekai_settings (
  key text primary key,
  value text
);
alter table public.sekai_settings enable row level security;
create policy "settings_select_all" on public.sekai_settings for select using (true);
insert into public.sekai_settings (key, value) values
  ('zoom_url', ''),
  ('youtube_url', '')
on conflict (key) do nothing;

-- 公式部活（運営シード）
insert into public.clubs (name, emoji, description, scope, is_official) values
  ('セカイムラ米部', '🌾', '米作りに苦労している農家を手伝い、使われていない田んぼを借りて村人自身が米を作る。2025年は全国で75枚の田んぼを蘇らせた', '全国', true),
  ('セカイムラ神社町', '⛩', '自分の住む地域の神社を、ミソカ（晦日）の日に掃除する', '全国', true);
