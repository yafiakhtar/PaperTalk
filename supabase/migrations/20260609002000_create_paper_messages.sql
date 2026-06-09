create table if not exists public.paper_messages (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint paper_messages_role check (role in ('user', 'assistant')),
  constraint paper_messages_content_length check (char_length(content) between 1 and 12000),
  constraint paper_messages_citations_array check (jsonb_typeof(citations) = 'array')
);

create index if not exists paper_messages_owner_paper_created_at_idx
  on public.paper_messages (owner_id, paper_id, created_at);

alter table public.paper_messages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.paper_messages to authenticated;

create policy "Users can read their own paper messages"
  on public.paper_messages
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_messages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can insert their own paper messages"
  on public.paper_messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_messages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can update their own paper messages"
  on public.paper_messages
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_messages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_messages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete their own paper messages"
  on public.paper_messages
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.papers
      where papers.id = paper_messages.paper_id
        and papers.owner_id = (select auth.uid())
    )
  );
