create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'visitor' check (role in ('admin', 'visitor')),
  created_at timestamptz not null default now()
);

create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  title_ru text not null,
  title_original text,
  type text not null check (type in ('movie', 'series', 'cartoon', 'anime', 'show')),
  year int,
  poster_url text not null,
  backdrop_url text,
  description text not null default '',
  genres text[] not null default '{}',
  countries text[] not null default '{}',
  tmdb_id int,
  kinopoisk_id int,
  my_rating numeric check (my_rating >= 0 and my_rating <= 10),
  my_review text,
  watched_at date,
  added_at timestamptz not null default now(),
  is_favorite boolean not null default false,
  is_top boolean not null default false,
  rewatch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public_ratings (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_items(id) on delete cascade,
  visitor_name text,
  rating numeric not null check (rating >= 1 and rating <= 10),
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_items(id) on delete cascade,
  visitor_name text not null,
  comment text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table media_items enable row level security;
alter table public_ratings enable row level security;
alter table comments enable row level security;

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

create policy "Anyone can read media" on media_items
  for select using (true);

create policy "Admins can insert media" on media_items
  for insert with check (public.is_admin());

create policy "Admins can update media" on media_items
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete media" on media_items
  for delete using (public.is_admin());

create policy "Anyone can add ratings" on public_ratings
  for insert with check (true);

create policy "Anyone can read ratings" on public_ratings
  for select using (true);

create policy "Anyone can add pending comments" on comments
  for insert with check (status = 'pending');

create policy "Anyone can read approved comments" on comments
  for select using (status = 'approved' or public.is_admin());

create policy "Admins can moderate comments" on comments
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete comments" on comments
  for delete using (public.is_admin());

create view media_with_guest_rating as
select
  m.*,
  round(avg(r.rating), 1) as guest_rating,
  count(r.id) as guest_votes
from media_items m
left join public_ratings r on r.media_id = m.id
group by m.id;
