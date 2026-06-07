create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 1 and 32),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$')
);

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.make_unique_username(email text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix text;
  attempt integer := 0;
begin
  base_username := split_part(coalesce(email, ''), '@', 1);
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_.-]+', '_', 'g');
  base_username := trim(both '._-' from base_username);

  if base_username = '' then
    base_username := 'user';
  end if;

  candidate := left(base_username, 32);

  while exists (
    select 1
    from public.profiles
    where lower(username) = lower(candidate)
      and id <> user_id
  ) loop
    attempt := attempt + 1;
    suffix := '-' || attempt::text;
    candidate := left(base_username, 32 - char_length(suffix)) || suffix;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, public.make_unique_username(new.email, new.id))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

do $$
declare
  auth_user record;
begin
  for auth_user in
    select users.id, users.email
    from auth.users users
    where not exists (
      select 1
      from public.profiles profiles
      where profiles.id = users.id
    )
    order by users.created_at
  loop
    insert into public.profiles (id, username)
    values (
      auth_user.id,
      public.make_unique_username(auth_user.email, auth_user.id)
    )
    on conflict (id) do nothing;
  end loop;
end;
$$;
