alter table public.papers
  drop constraint if exists papers_extraction_status;

update public.papers
set extraction_status = 'completed'
where extraction_status = 'ready';

alter table public.papers
  add constraint papers_extraction_status
  check (extraction_status in ('pending', 'extracting', 'completed', 'failed'));
