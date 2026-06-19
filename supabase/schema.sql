-- supabase/schema.sql
create table if not exists public.prices (
  item_id    bigint primary key,
  price      double precision not null,
  updated_at timestamptz not null default now()
);

alter table public.prices enable row level security;

create policy "anon read prices"   on public.prices for select to anon using (true);
create policy "anon insert prices" on public.prices for insert to anon with check (true);
create policy "anon update prices" on public.prices for update to anon using (true) with check (true);

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  name       text,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone may read all feedback and append a new entry; no update/delete from the client.
create policy "anon read feedback"   on public.feedback for select to anon using (true);
create policy "anon insert feedback" on public.feedback for insert to anon with check (true);
