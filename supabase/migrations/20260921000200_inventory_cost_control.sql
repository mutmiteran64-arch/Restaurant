-- Professional inventory controls:
-- 1) Purchases only increase stock when explicitly RECEIVED.
-- 2) Purchase reception updates weighted-average ingredient cost atomically.
-- 3) Losses/breakage and physical inventory adjustments are atomic and audited.
-- 4) Menu product cost is derived from its recipe and current ingredient costs.

alter table public.purchase_orders
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid references auth.users(id) on delete set null;

create or replace function public.refresh_product_recipe_cost(p_product_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_cost numeric(12,4);
begin
  select tenant_id into v_tenant from public.products where id = p_product_id;
  if v_tenant is null then
    return 0;
  end if;

  select coalesce(sum(ri.quantity * i.cost_per_unit), 0)
    into v_cost
  from public.recipe_items ri
  join public.ingredients i on i.id = ri.ingredient_id
  where ri.product_id = p_product_id
    and ri.tenant_id = v_tenant
    and i.tenant_id = v_tenant;

  update public.products
  set cost = round(v_cost, 2)
  where id = p_product_id and tenant_id = v_tenant;

  return round(v_cost, 2);
end;
$$;

create or replace function public.refresh_all_product_recipe_costs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.products where tenant_id = (select tenant_id from public.profiles where id = auth.uid()) loop
    perform public.refresh_product_recipe_cost(r.id);
  end loop;
end;
$$;

create or replace function public.receive_purchase_order(p_purchase_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_po public.purchase_orders%rowtype;
  v_item record;
  v_product record;
  v_ing public.ingredients%rowtype;
  v_old_qty numeric(12,3);
  v_old_cost numeric(10,2);
  v_new_qty numeric(12,3);
  v_new_cost numeric(10,2);
begin
  select * into v_profile from public.profiles where id = v_user and active = true;
  if not found then raise exception 'Utilisateur non autorisé'; end if;
  if v_profile.role not in ('owner','manager','storekeeper') then raise exception 'Seuls le propriétaire, le manager ou le magasinier peuvent réceptionner un achat'; end if;

  select * into v_po
  from public.purchase_orders
  where id = p_purchase_order_id and tenant_id = v_profile.tenant_id
  for update;
  if not found then raise exception 'Commande d’achat introuvable'; end if;
  if v_po.status = 'received' then raise exception 'Cette commande a déjà été réceptionnée'; end if;
  if v_po.status = 'cancelled' then raise exception 'Cette commande est annulée'; end if;

  for v_item in
    select * from public.purchase_order_items
    where purchase_order_id = v_po.id
    order by ingredient_id
  loop
    if v_item.ingredient_id is null or v_item.quantity <= 0 then
      raise exception 'Article d’achat invalide';
    end if;

    select * into v_ing from public.ingredients
    where id = v_item.ingredient_id and tenant_id = v_profile.tenant_id
    for update;
    if not found then raise exception 'Ingrédient introuvable: %', v_item.ingredient_name; end if;

    v_old_qty := greatest(v_ing.quantity, 0);
    v_old_cost := greatest(v_ing.cost_per_unit, 0);
    v_new_qty := v_old_qty + v_item.quantity;
    v_new_cost := case
      when v_new_qty > 0 then round(((v_old_qty * v_old_cost) + (v_item.quantity * v_item.unit_price)) / v_new_qty, 2)
      else v_old_cost
    end;

    update public.ingredients
    set quantity = v_new_qty,
        cost_per_unit = v_new_cost,
        supplier_id = coalesce(v_po.supplier_id, supplier_id)
    where id = v_ing.id;

    insert into public.stock_movements (
      tenant_id, ingredient_id, ingredient_name, type, cause, quantity, unit_cost, reference, user_name
    ) values (
      v_profile.tenant_id, v_ing.id, v_ing.name, 'in', 'purchase', v_item.quantity,
      v_item.unit_price, 'Réception PO #' || v_po.po_number, v_profile.full_name
    );
  end loop;

  update public.purchase_orders
  set status = 'received', received_at = now(), received_by = v_user
  where id = v_po.id;

  for v_item in select distinct ingredient_id from public.purchase_order_items where purchase_order_id = v_po.id and ingredient_id is not null loop
    for v_product in select p.id from public.products p join public.recipe_items ri on ri.product_id = p.id where ri.ingredient_id = v_item.ingredient_id and p.tenant_id = v_profile.tenant_id loop
      perform public.refresh_product_recipe_cost(v_product.id);
    end loop;
  end loop;

  insert into public.audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details)
  values (v_profile.tenant_id, v_user, v_profile.full_name, 'receive_purchase', 'purchase_order', v_po.id,
          jsonb_build_object('po_number', v_po.po_number, 'total', v_po.total));

  return jsonb_build_object('purchase_order_id', v_po.id, 'status', 'received');
end;
$$;

create or replace function public.record_stock_loss(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_cause text default 'waste',
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_ing public.ingredients%rowtype;
  v_qty numeric(12,3) := abs(coalesce(p_quantity, 0));
  v_cause text := case when p_cause in ('waste','breakage') then p_cause else 'waste' end;
begin
  select * into v_profile from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Utilisateur non autorisé'; end if;
  if v_profile.role not in ('owner','manager','storekeeper') then raise exception 'Vous n’êtes pas autorisé à enregistrer une perte'; end if;
  if v_qty <= 0 then raise exception 'La quantité doit être supérieure à zéro'; end if;

  select * into v_ing from public.ingredients
  where id = p_ingredient_id and tenant_id = v_profile.tenant_id
  for update;
  if not found then raise exception 'Ingrédient introuvable'; end if;
  if v_ing.quantity < v_qty then raise exception 'Stock insuffisant pour %', v_ing.name; end if;

  update public.ingredients set quantity = quantity - v_qty where id = v_ing.id;
  insert into public.stock_movements (tenant_id, ingredient_id, ingredient_name, type, cause, quantity, unit_cost, reference, user_name)
  values (v_profile.tenant_id, v_ing.id, v_ing.name, 'waste', v_cause, -v_qty, v_ing.cost_per_unit, p_reference, v_profile.full_name);

  insert into public.audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details)
  values (v_profile.tenant_id, auth.uid(), v_profile.full_name, 'stock_loss', 'ingredient', v_ing.id,
          jsonb_build_object('quantity', v_qty, 'cause', v_cause, 'reference', p_reference));
  return jsonb_build_object('ingredient_id', v_ing.id, 'remaining', v_ing.quantity - v_qty);
end;
$$;

create or replace function public.adjust_physical_inventory(
  p_ingredient_id uuid,
  p_counted_quantity numeric,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_ing public.ingredients%rowtype;
  v_diff numeric(12,3);
begin
  select * into v_profile from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Utilisateur non autorisé'; end if;
  if v_profile.role not in ('owner','manager','storekeeper') then raise exception 'Vous n’êtes pas autorisé à faire un inventaire'; end if;
  if p_counted_quantity < 0 then raise exception 'Le stock compté ne peut pas être négatif'; end if;

  select * into v_ing from public.ingredients
  where id = p_ingredient_id and tenant_id = v_profile.tenant_id
  for update;
  if not found then raise exception 'Ingrédient introuvable'; end if;

  v_diff := p_counted_quantity - v_ing.quantity;
  update public.ingredients set quantity = p_counted_quantity where id = v_ing.id;

  if v_diff <> 0 then
    insert into public.stock_movements (tenant_id, ingredient_id, ingredient_name, type, cause, quantity, unit_cost, reference, user_name)
    values (v_profile.tenant_id, v_ing.id, v_ing.name, 'adjust', 'adjustment', v_diff, v_ing.cost_per_unit,
            coalesce(p_reference, 'Inventaire physique'), v_profile.full_name);
  end if;

  insert into public.audit_logs (tenant_id, user_id, user_name, action, entity_type, entity_id, details)
  values (v_profile.tenant_id, auth.uid(), v_profile.full_name, 'inventory_adjustment', 'ingredient', v_ing.id,
          jsonb_build_object('before', v_ing.quantity, 'counted', p_counted_quantity, 'difference', v_diff, 'reference', p_reference));
  return jsonb_build_object('ingredient_id', v_ing.id, 'difference', v_diff, 'quantity', p_counted_quantity);
end;
$$;

revoke all on function public.receive_purchase_order(uuid) from public;
revoke all on function public.record_stock_loss(uuid,numeric,text,text) from public;
revoke all on function public.adjust_physical_inventory(uuid,numeric,text) from public;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
grant execute on function public.record_stock_loss(uuid,numeric,text,text) to authenticated;
grant execute on function public.adjust_physical_inventory(uuid,numeric,text) to authenticated;

-- Keep product cost aligned with recipe whenever an ingredient cost or recipe changes.
create or replace function public.sync_product_cost_from_recipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'recipe_items' then
    perform public.refresh_product_recipe_cost(coalesce(new.product_id, old.product_id));
  elsif tg_table_name = 'ingredients' then
    update public.products p
    set cost = round(coalesce((select sum(ri.quantity * i.cost_per_unit) from public.recipe_items ri join public.ingredients i on i.id = ri.ingredient_id where ri.product_id = p.id), 0), 2)
    where p.tenant_id = coalesce(new.tenant_id, old.tenant_id)
      and exists (select 1 from public.recipe_items ri where ri.product_id = p.id and ri.ingredient_id = coalesce(new.id, old.id));
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_product_cost_recipe on public.recipe_items;
create trigger trg_sync_product_cost_recipe
after insert or update or delete on public.recipe_items
for each row execute function public.sync_product_cost_from_recipe();

drop trigger if exists trg_sync_product_cost_ingredient on public.ingredients;
create trigger trg_sync_product_cost_ingredient
after update of cost_per_unit on public.ingredients
for each row execute function public.sync_product_cost_from_recipe();
