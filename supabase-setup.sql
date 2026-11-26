-- Nikoleta Wellness Learning Center: secure multi-device sync
-- Run once in Supabase Dashboard > SQL Editor > New query.

create table if not exists public.learning_center_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, record_id)
);

alter table public.learning_center_records enable row level security;

drop policy if exists "Users read their own learning records" on public.learning_center_records;
create policy "Users read their own learning records"
on public.learning_center_records for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users insert their own learning records" on public.learning_center_records;
create policy "Users insert their own learning records"
on public.learning_center_records for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users update their own learning records" on public.learning_center_records;
create policy "Users update their own learning records"
on public.learning_center_records for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users delete their own learning records" on public.learning_center_records;
create policy "Users delete their own learning records"
on public.learning_center_records for delete
to authenticated
using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('learning-center-files', 'learning-center-files', false, 524288000)
on conflict (id) do update
set public = false, file_size_limit = 524288000;

drop policy if exists "Users read their own learning center files" on storage.objects;
create policy "Users read their own learning center files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'learning-center-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users upload their own learning center files" on storage.objects;
create policy "Users upload their own learning center files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'learning-center-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update their own learning center files" on storage.objects;
create policy "Users update their own learning center files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'learning-center-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'learning-center-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete their own learning center files" on storage.objects;
create policy "Users delete their own learning center files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'learning-center-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  alter publication supabase_realtime add table public.learning_center_records;
exception
  when duplicate_object then null;
end $$;
