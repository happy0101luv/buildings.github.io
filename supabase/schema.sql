-- 在 Supabase Dashboard > SQL Editor 中完整执行一次。

create table if not exists public.collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  records jsonb not null default '[]'::jsonb check (jsonb_typeof(records) = 'array'),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collections enable row level security;
revoke all on public.collections from anon;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users read own collection" on public.collections;
create policy "Users read own collection"
on public.collections for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own collection" on public.collections;
create policy "Users insert own collection"
on public.collections for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own collection" on public.collections;
create policy "Users update own collection"
on public.collections for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own collection" on public.collections;
create policy "Users delete own collection"
on public.collections for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.save_collection(new_records jsonb, expected_version bigint)
returns table(records jsonb, version bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(new_records) <> 'array' then raise exception 'records_must_be_array'; end if;

  insert into public.collections(user_id, records, version, updated_at)
  values (caller, new_records, 1, now())
  on conflict (user_id) do update
    set records = excluded.records,
        version = public.collections.version + 1,
        updated_at = now()
    where public.collections.version = expected_version;

  if not found then raise exception 'collection_version_conflict'; end if;
  return query select c.records, c.version from public.collections c where c.user_id = caller;
end;
$$;

revoke all on function public.save_collection(jsonb, bigint) from public;
grant execute on function public.save_collection(jsonb, bigint) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'collection-images',
  'collection-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users select own collection images" on storage.objects;
create policy "Users select own collection images"
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users upload own collection images" on storage.objects;
create policy "Users upload own collection images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users update own collection images" on storage.objects;
create policy "Users update own collection images"
on storage.objects for update to authenticated
using (
  bucket_id = 'collection-images'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'collection-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users delete own collection images" on storage.objects;
create policy "Users delete own collection images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'collection-images'
  and owner_id = (select auth.uid()::text)
);
