-- OTOHIKARI: 朝3:36リセット方式
-- その日3:36以降にシューマン音を再生した場所を、一日中光らせ続ける。
-- spots は同一地点を GROUP BY + 上位500点に間引くので、
-- 何万人灯っても配信JSONのサイズは変わらない（パケ死しない）。
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
        -- 直近の朝3:36(JST)以降に再生した場所
        where last_seen >= ((((now() at time zone 'Asia/Tokyo') - interval '3 hours 36 minutes')::date
                            + interval '3 hours 36 minutes') at time zone 'Asia/Tokyo')
          and lat is not null
        group by lat, lng
        order by c desc
        limit 500
      ) s), '[]'::jsonb)
  );
$$;
