-- Account creation model:
-- 1) only the first owner can be created from the public first page;
-- 2) after that, staff accounts are created by the owner through a server-side Edge Function.

-- The original multi-tenant migration created a placeholder tenant when the database was empty.
-- Keep that placeholder only as an installation marker; the first owner can claim it.

create or replace function public.initial_setup_available()
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.tenant_members where role = 'owner' and active = true)
     and (
       not exists (select 1 from public.tenants)
       or (
         (select count(*) from public.tenants) = 1
         and exists (
           select 1 from public.tenants
           where name = 'Restaurant principal'
             and not exists (select 1 from public.tenant_members tm where tm.tenant_id = tenants.id)
             and not exists (select 1 from public.profiles p where p.tenant_id = tenants.id)
         )
       )
     );
$$;

revoke all on function public.initial_setup_available() from public;
grant execute on function public.initial_setup_available() to anon, authenticated, service_role;

create or replace function public.bootstrap_initial_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_restaurant_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_slug text;
begin
  perform pg_advisory_xact_lock(hashtext('restoflow-initial-owner'));

  if not public.initial_setup_available() then
    raise exception 'Le compte principal existe déjà';
  end if;

  if p_user_id is null then raise exception 'Utilisateur invalide'; end if;
  if nullif(trim(p_email), '') is null then raise exception 'Email obligatoire'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Nom obligatoire'; end if;
  if nullif(trim(p_restaurant_name), '') is null then raise exception 'Nom du restaurant obligatoire'; end if;

  select id into v_tenant
  from public.tenants
  where name = 'Restaurant principal'
    and not exists (select 1 from public.tenant_members tm where tm.tenant_id = tenants.id)
    and not exists (select 1 from public.profiles p where p.tenant_id = tenants.id)
  order by created_at
  limit 1;

  if v_tenant is null then
    v_slug := regexp_replace(lower(trim(p_restaurant_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(p_user_id::text,'-',''),1,8);
    insert into public.tenants(name, slug)
    values (trim(p_restaurant_name), v_slug)
    returning id into v_tenant;
  else
    update public.tenants
    set name = trim(p_restaurant_name),
        slug = regexp_replace(lower(trim(p_restaurant_name)), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(p_user_id::text,'-',''),1,8)
    where id = v_tenant;
  end if;

  insert into public.profiles(id, email, full_name, role, active, tenant_id)
  values (p_user_id, lower(trim(p_email)), trim(p_full_name), 'owner', true, v_tenant)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = 'owner',
        active = true,
        tenant_id = excluded.tenant_id;

  insert into public.tenant_members(tenant_id, user_id, role, active)
  values (v_tenant, p_user_id, 'owner', true)
  on conflict (tenant_id, user_id) do update set role = 'owner', active = true;

  return v_tenant;
end;
$$;

revoke all on function public.bootstrap_initial_owner(uuid, text, text, text) from public;
grant execute on function public.bootstrap_initial_owner(uuid, text, text, text) to service_role;

-- Owner-only profile management. Existing tenant policies are replaced so managers cannot
-- create/modify accounts through the browser by bypassing the Staff UI.
drop policy if exists tenant_insert on public.profiles;
drop policy if exists tenant_update on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;

create policy profiles_owner_update on public.profiles
for update to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = profiles.tenant_id
      and tm.role = 'owner'
      and tm.active = true
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1 from public.tenant_members tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = profiles.tenant_id
      and tm.role = 'owner'
      and tm.active = true
  )
);

-- Direct client-side profile creation is disabled. Profiles are created by the owner
-- bootstrap RPC or the create-staff-user Edge Function using the service role.
drop policy if exists tenant_insert on public.profiles;

-- Owners may see members in their tenant; ordinary members retain tenant-scoped reads.
drop policy if exists member_select on public.tenant_members;
create policy member_select on public.tenant_members
for select to authenticated
using (user_id = auth.uid() or tenant_id in (select public.user_tenant_ids()));

-- No frontend code should be able to create additional tenants after the initial setup.
revoke execute on function public.create_tenant_for_current_user(text) from authenticated, anon;
