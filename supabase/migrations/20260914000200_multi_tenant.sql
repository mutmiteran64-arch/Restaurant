-- Multi-tenant isolation for Restaurant
create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'server' check (role in ('owner','manager','cashier','server','chef','storekeeper','accountant')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

create or replace function public.user_tenant_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select tenant_id from public.tenant_members where user_id = auth.uid() and active = true $$;

revoke all on function public.user_tenant_ids() from public;
grant execute on function public.user_tenant_ids() to authenticated;

-- Add tenant_id to every business table. Existing rows are assigned to one legacy tenant.
do $$
declare t uuid; tbl text;
begin
  select id into t from public.tenants order by created_at limit 1;
  if t is null then
    insert into public.tenants(name, slug) values ('Restaurant principal', 'restaurant-principal') returning id into t;
  end if;

  foreach tbl in array array['profiles','categories','products','ingredients','recipe_items','restaurant_tables','reservations','cash_sessions','orders','order_items','payments','suppliers','purchase_orders','purchase_order_items','stock_movements','expenses','attendance','audit_logs'] loop
    execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)', tbl);
    execute format('update public.%I set tenant_id = $1 where tenant_id is null', tbl) using t;
    execute format('alter table public.%I alter column tenant_id set not null', tbl);
    execute format('create index if not exists %I on public.%I(tenant_id)', tbl || '_tenant_id_idx', tbl);
  end loop;

  insert into public.tenant_members(tenant_id,user_id,role)
  select t, p.id, case when p.role = 'owner' then 'owner' else p.role end
  from public.profiles p
  on conflict (tenant_id,user_id) do update set role = excluded.role;
end $$;

-- New registrations can create their own tenant through this RPC.
create or replace function public.create_tenant_for_current_user(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_tenant uuid; v_slug text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.tenant_members where user_id = auth.uid() and active) then
    return (select tenant_id from public.tenant_members where user_id = auth.uid() and active limit 1);
  end if;
  v_slug := regexp_replace(lower(coalesce(nullif(trim(p_name),''),'restaurant')), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(auth.uid()::text,'-',''),1,8);
  insert into public.tenants(name,slug) values (coalesce(nullif(trim(p_name),''),'Restaurant'), v_slug) returning id into v_tenant;
  insert into public.tenant_members(tenant_id,user_id,role) values (v_tenant,auth.uid(),'owner');
  update public.profiles set tenant_id=v_tenant, role='owner' where id=auth.uid();
  return v_tenant;
end $$;

revoke all on function public.create_tenant_for_current_user(text) from public;
grant execute on function public.create_tenant_for_current_user(text) to authenticated;

-- Replace legacy broad policies with tenant-scoped policies.
do $$
declare tbl text; pol record;
begin
  foreach tbl in array array['profiles','categories','products','ingredients','recipe_items','restaurant_tables','reservations','cash_sessions','orders','order_items','payments','suppliers','purchase_orders','purchase_order_items','stock_movements','expenses','attendance','audit_logs'] loop
    for pol in select policyname from pg_policies where schemaname='public' and tablename=tbl loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id in (select public.user_tenant_ids()))', tbl);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (tenant_id in (select public.user_tenant_ids()))', tbl);
    execute format('create policy tenant_update on public.%I for update to authenticated using (tenant_id in (select public.user_tenant_ids())) with check (tenant_id in (select public.user_tenant_ids()))', tbl);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (tenant_id in (select public.user_tenant_ids()))', tbl);
  end loop;
end $$;

create policy tenant_select on public.tenants for select to authenticated using (id in (select public.user_tenant_ids()));
create policy tenant_update on public.tenants for update to authenticated using (id in (select public.user_tenant_ids())) with check (id in (select public.user_tenant_ids()));
create policy member_select on public.tenant_members for select to authenticated using (user_id = auth.uid() or tenant_id in (select public.user_tenant_ids()));

-- Ensure anonymous clients cannot access tenant data.
revoke all on all tables in schema public from anon;

-- Backward-compatible safety: existing frontend inserts that omit tenant_id get the
-- current user's tenant automatically, preventing accidental cross-tenant writes.
create or replace function public.assign_current_tenant()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_tenant uuid;
begin
  if new.tenant_id is null then
    select tenant_id into v_tenant from public.tenant_members where user_id=auth.uid() and active=true limit 1;
    if v_tenant is null then raise exception 'No active tenant for current user'; end if;
    new.tenant_id := v_tenant;
  end if;
  if not exists (select 1 from public.tenant_members where user_id=auth.uid() and tenant_id=new.tenant_id and active=true) then
    raise exception 'User is not a member of this tenant';
  end if;
  return new;
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array['categories','products','ingredients','recipe_items','restaurant_tables','reservations','cash_sessions','orders','order_items','payments','suppliers','purchase_orders','purchase_order_items','stock_movements','expenses','attendance','audit_logs'] loop
    execute format('drop trigger if exists assign_current_tenant on public.%I', tbl);
    execute format('create trigger assign_current_tenant before insert on public.%I for each row execute function public.assign_current_tenant()', tbl);
  end loop;
end $$;
