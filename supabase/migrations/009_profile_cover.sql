-- マイページ強化: カバー画像・自己紹介・アバターのアップロード先
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists bio text;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert_auth" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "avatars_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and owner = auth.uid());
