-- セカイムラ公式拠点（事務局が認定）と一般拠点の分類
alter table public.villages
  add column is_official boolean not null default false;
-- 公式認定は sekai_settings の admin_user_id 宛に申請 → 事務局が
-- update villages set is_official = true where id = ... で認定する
