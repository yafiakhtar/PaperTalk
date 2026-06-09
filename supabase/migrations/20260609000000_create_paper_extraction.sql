alter table public.papers
  add column if not exists extraction_status text not null default 'pending',
  add column if not exists extraction_error text,
  add column if not exists extracted_at timestamptz,
  add column if not exists page_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'papers_extraction_status'
      and conrelid = 'public.papers'::regclass
  ) then
    alter table public.papers
      add constraint papers_extraction_status
      check (extraction_status in ('pending', 'extracting', 'ready', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'papers_page_count'
      and conrelid = 'public.papers'::regclass
  ) then
    alter table public.papers
      add constraint papers_page_count
      check (page_count is null or page_count > 0);
  end if;
end $$;

create table if not exists public.paper_pages (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null,
  text text not null,
  char_count integer not null,
  created_at timestamptz not null default now(),
  constraint paper_pages_page_number check (page_number > 0),
  constraint paper_pages_char_count check (char_count >= 0),
  constraint paper_pages_unique_page unique (paper_id, page_number)
);

create index if not exists paper_pages_owner_paper_page_idx
  on public.paper_pages (owner_id, paper_id, page_number);

alter table public.paper_pages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.paper_pages to authenticated;

create policy "Users can read their own paper pages"
  on public.paper_pages
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can insert their own paper pages"
  on public.paper_pages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_pages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can update their own paper pages"
  on public.paper_pages
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_pages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete their own paper pages"
  on public.paper_pages
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create table if not exists public.paper_chunks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  text text not null,
  start_char integer not null,
  end_char integer not null,
  created_at timestamptz not null default now(),
  constraint paper_chunks_page_number check (page_number > 0),
  constraint paper_chunks_chunk_index check (chunk_index >= 0),
  constraint paper_chunks_char_range check (start_char >= 0 and end_char >= start_char),
  constraint paper_chunks_unique_chunk unique (paper_id, page_number, chunk_index)
);

create index if not exists paper_chunks_owner_paper_page_idx
  on public.paper_chunks (owner_id, paper_id, page_number, chunk_index);

alter table public.paper_chunks enable row level security;

grant select, insert, update, delete on table public.paper_chunks to authenticated;

create policy "Users can read their own paper chunks"
  on public.paper_chunks
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can insert their own paper chunks"
  on public.paper_chunks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_chunks.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can update their own paper chunks"
  on public.paper_chunks
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_chunks.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete their own paper chunks"
  on public.paper_chunks
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);
