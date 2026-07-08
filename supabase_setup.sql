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
