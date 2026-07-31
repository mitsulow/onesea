-- 活動報告に「イベント投稿」（日時つき・参加すると各自の手帳に入る）
alter table public.village_posts
  add column kind text not null default 'normal' check (kind in ('normal', 'event'));
alter table public.village_posts add column event_at timestamptz;
