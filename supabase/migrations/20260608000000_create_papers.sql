insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'papers',
  'papers',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  file_size bigint not null,
  mime_type text not null default 'application/pdf',
  status text not null default 'uploading',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papers_title_length check (char_length(title) between 1 and 240),
  constraint papers_pdf_size check (file_size > 0 and file_size <= 26214400),
  constraint papers_pdf_mime_type check (mime_type = 'application/pdf'),
  constraint papers_status check (status in ('uploading', 'ready')),
  constraint papers_storage_path_matches_owner check (
    storage_path = owner_id::text || '/' || id::text || '/original.pdf'
  )
);

create index if not exists papers_owner_created_at_idx
  on public.papers (owner_id, created_at desc);

alter table public.papers enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.papers to authenticated;

create policy "Users can read their own papers"
  on public.papers
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can insert their own papers"
  on public.papers
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own papers"
  on public.papers
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own papers"
  on public.papers
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

drop trigger if exists papers_set_updated_at on public.papers;

create trigger papers_set_updated_at
  before update on public.papers
  for each row
  execute function public.set_updated_at();

grant usage on schema storage to authenticated;
grant select on table storage.buckets to authenticated;
grant select, insert, update, delete on table storage.objects to authenticated;

create policy "Users can read their own paper files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own paper files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own paper files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own paper files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'papers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
