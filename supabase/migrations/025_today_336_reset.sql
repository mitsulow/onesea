-- TODAY（今日の再生回数）も朝3:36(JST)リセットに統一
-- （光の積算 spots は 024 で対応済み。これで全ての「今日」が3:36切り替えになる）
create or replace function public.otohikari_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'now', (select count(*) from beacons where last_seen > now() - interval '45 seconds'),
    'today', (select count(*) from listens
      where created_at >= ((((now() at time zone 'Asia/Tokyo') - interval '3 hours 36 minutes')::date
                           + interval '3 hours 36 minutes') at time zone 'Asia/Tokyo')),
    'spots', coalesce((
      select jsonb_agg(jsonb_build_array(lat, lng, c))
      from (
        select lat, lng, count(*) as c
        from beacons
        where last_seen >= ((((now() at time zone 'Asia/Tokyo') - interval '3 hours 36 minutes')::date
                            + interval '3 hours 36 minutes') at time zone 'Asia/Tokyo')
          and lat is not null
        group by lat, lng
        order by c desc
        limit 500
      ) s), '[]'::jsonb)
  );
$$;
