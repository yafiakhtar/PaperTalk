create extension if not exists vector with schema extensions;

set search_path = public, extensions;

alter table public.paper_chunks
  add column if not exists embedding extensions.vector(768);

create index if not exists paper_chunks_embedding_hnsw_idx
  on public.paper_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_paper_chunks(
  match_paper_id uuid,
  query_embedding extensions.vector(768),
  match_count integer default 8,
  match_threshold double precision default 0
)
returns table (
  id uuid,
  page_number integer,
  chunk_index integer,
  text text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    paper_chunks.id,
    paper_chunks.page_number,
    paper_chunks.chunk_index,
    paper_chunks.text,
    1 - (paper_chunks.embedding <=> query_embedding) as similarity
  from public.paper_chunks
  where paper_chunks.paper_id = match_paper_id
    and paper_chunks.owner_id = (select auth.uid())
    and paper_chunks.embedding is not null
    and 1 - (paper_chunks.embedding <=> query_embedding) >= match_threshold
  order by paper_chunks.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.match_paper_chunks(
  uuid,
  extensions.vector,
  integer,
  double precision
) to authenticated;
