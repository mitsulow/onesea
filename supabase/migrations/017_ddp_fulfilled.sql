-- 今日のDDPは何％叶ったか（シンクロモードの夜の振り返り）
alter table public.daily_ddp
  add column fulfilled_pct int check (fulfilled_pct between 0 and 100);
