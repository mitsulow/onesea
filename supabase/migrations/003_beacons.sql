-- 点呼方式（パケ死しない集計）:
-- 上り: 再生中の端末が30秒ごとに自分の行を upsert（約100バイト）
-- 集計: otohikari_snapshot() が SQL 1発で数える
-- 下り: /api/otohikari が30秒キャッシュの JSON 1枚を配る（CDNが受ける）

create table public.beacons (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision,
  lng double precision,
  last_seen timestamptz not null default now()
);
alter table public.beacons enable row level security;
create policy "beacons_own" on public.beacons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.otohikari_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'now', (select count(*) from beacons where last_seen > now() - interval '45 seconds'),
    'today', (select count(*) from listens
      where created_at >= ((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo'),
    'spots', coalesce((
      select jsonb_agg(jsonb_build_array(lat, lng, c))
      from (
        select lat, lng, count(*) as c
        from beacons
        where last_seen > now() - interval '45 seconds' and lat is not null
        group by lat, lng
        order by c desc
        limit 500
      ) s), '[]'::jsonb)
  );
$$;
grant execute on function public.otohikari_snapshot() to anon, authenticated;
