create table public.entitlements (user_id uuid not null references auth.users(id) on delete cascade, product text not null check(product='studio-full'), active boolean not null default true, primary key(user_id,product));
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon,authenticated;
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;
create policy own_access on public.entitlements for select to authenticated using(auth.uid()=user_id);
