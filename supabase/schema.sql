create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'visitor' check (role in ('admin', 'visitor')),
  created_at timestamptz not null default now()
);

create table if not exists media_items (
  id text primary key,
  title_ru text not null,
  title_original text,
  type text not null check (type in ('movie', 'series', 'cartoon', 'anime', 'show')),
  year int,
  poster_url text not null default '',
  backdrop_url text,
  description text not null default '',
  genres text[] not null default '{}',
  countries text[] not null default '{}',
  tmdb_id int,
  kinopoisk_id int,
  imdb_id text,
  kinopoisk_rating numeric check (kinopoisk_rating >= 0 and kinopoisk_rating <= 10),
  imdb_rating numeric check (imdb_rating >= 0 and imdb_rating <= 10),
  my_rating numeric check (my_rating >= 0 and my_rating <= 10),
  my_review text,
  watched_at date,
  added_at timestamptz not null default now(),
  is_favorite boolean not null default false,
  is_top boolean not null default false,
  top_rank int check (top_rank >= 1 and top_rank <= 5),
  rewatch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public_ratings (
  id uuid primary key default gen_random_uuid(),
  media_id text not null references media_items(id) on delete cascade,
  visitor_name text,
  rating numeric not null check (rating >= 1 and rating <= 10),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'Система',
  action text not null,
  target text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  media_id text not null references media_items(id) on delete cascade,
  visitor_name text not null,
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table media_items enable row level security;
alter table public_ratings enable row level security;
alter table comments enable row level security;
alter table activity_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'visitor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "Admins can update profiles" on profiles
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read media" on media_items
  for select using (true);

create policy "Admins can insert media" on media_items
  for insert with check (public.is_admin());

create policy "Admins can update media" on media_items
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete media" on media_items
  for delete using (public.is_admin());

create policy "Anyone can add pending ratings" on public_ratings
  for insert with check (status = 'pending');

create policy "Anyone can read approved ratings" on public_ratings
  for select using (status = 'approved' or public.is_admin());

create policy "Admins can moderate ratings" on public_ratings
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete ratings" on public_ratings
  for delete using (public.is_admin());

create policy "Anyone can add pending comments" on comments
  for insert with check (status = 'pending');

create policy "Anyone can read approved comments" on comments
  for select using (status = 'approved' or public.is_admin());

create policy "Admins can moderate comments" on comments
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete comments" on comments
  for delete using (public.is_admin());

create policy "Admins can read activity logs" on activity_logs
  for select using (public.is_admin());

create policy "Anyone can insert activity logs" on activity_logs
  for insert with check (true);

create policy "Admins can delete activity logs" on activity_logs
  for delete using (public.is_admin());

create view media_with_guest_rating as
select
  m.*,
  round(avg(r.rating), 1) as guest_rating,
  count(r.id) as guest_votes
from media_items m
left join public_ratings r on r.media_id = m.id and r.status = 'approved'
group by m.id;
