-- Run this once in the Supabase SQL Editor

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tier text not null default 'free' check (tier in ('free', 'paid')),
  stripe_customer_id text,
  unlocked_at timestamptz
);

alter table public.profiles enable row level security;

-- Users may read only their own row. No insert/update policy is granted to
-- the authenticated role at all -- only the service_role key (used inside
-- the Stripe webhook Edge Function) can write tier.
create policy "select_own_profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profiles row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Cloud-synced designs. Unlike profiles (server-writes-only via service_role),
-- users must read/write their OWN design rows directly from the client --
-- this is a standard per-user-owned-data RLS use case, no Edge Function needed.
create table public.designs (
  id text primary key,              -- reuse client-generated 'd<ts>_<rand6>' id, so
                                     -- local <-> cloud ids never collide/rewrite on sync
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled design',
  data jsonb not null,               -- mirrors today's localStorage `data` sub-object as-is
  saved_at bigint not null,          -- epoch ms, same field name/type as design.savedAt today
  updated_at timestamptz not null default now()
);

create index designs_user_id_idx on public.designs (user_id);

alter table public.designs enable row level security;

-- Every operation scoped to the owner. Regular authenticated users need full
-- CRUD on their own rows (this is not a server-secret-gated flow like Stripe).
create policy "select_own_designs" on public.designs for select using (auth.uid() = user_id);
create policy "insert_own_designs" on public.designs for insert with check (auth.uid() = user_id);
create policy "update_own_designs" on public.designs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_designs" on public.designs for delete using (auth.uid() = user_id);

-- Keep updated_at accurate server-side regardless of client clock skew.
create function public.touch_designs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger designs_touch_updated_at
  before update on public.designs
  for each row execute procedure public.touch_designs_updated_at();
