-- Cotozute 写真投稿: サムネ+本体の2枚方式（パケ死しない配信）
alter table public.posts add column if not exists thumb_urls text[] not null default '{}';

insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;
create policy "post_images_read" on storage.objects
  for select using (bucket_id = 'post-images');
create policy "post_images_insert_auth" on storage.objects
  for insert with check (bucket_id = 'post-images' and auth.role() = 'authenticated');
create policy "post_images_delete_own" on storage.objects
  for delete using (bucket_id = 'post-images' and owner = auth.uid());
