-- Professional stock/order integration:
-- a paid order and its stock consumption are committed in ONE transaction.
-- Stock is deducted from recipe_items, not from the menu product itself.
-- If any ingredient is insufficient, the whole checkout is rejected and nothing is recorded.

create or replace function public.checkout_order_with_stock(
  p_order_number integer,
  p_table_id uuid default null,
  p_cash_session_id uuid default null,
  p_method text default 'cash',
  p_discount numeric default 0,
  p_tax_rate numeric default 0,
  p_tip numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
  v_tax_amount numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_discount numeric(10,2) := greatest(coalesce(p_discount, 0), 0);
  v_tax_rate numeric(5,2) := greatest(coalesce(p_tax_rate, 0), 0);
  v_tip numeric(10,2) := greatest(coalesce(p_tip, 0), 0);
  v_table_name text;
  v_ingredient public.ingredients%rowtype;
  v_required numeric(12,3);
begin
  if v_user_id is null then
    raise exception 'Vous devez être connecté pour encaisser une commande';
  end if;

  if p_method not in ('cash', 'card', 'mobile_money', 'mixed') then
    raise exception 'Mode de paiement invalide';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La commande ne contient aucun article';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id and active = true;

  if not found or v_profile.tenant_id is null then
    raise exception 'Profil utilisateur ou restaurant introuvable';
  end if;

  -- Calculate the sale from server-side product prices. The browser cannot alter them.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce((v_item->>'quantity')::integer, 0) <= 0 then
      raise exception 'Quantité invalide pour un article';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and tenant_id = v_profile.tenant_id
      and available = true;

    if not found then
      raise exception 'Produit indisponible ou introuvable';
    end if;

    v_qty := (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  if v_discount > v_subtotal then
    raise exception 'La remise ne peut pas dépasser le sous-total';
  end if;

  v_tax_amount := round(greatest(v_subtotal - v_discount, 0) * v_tax_rate / 100, 2);
  v_total := round(v_subtotal - v_discount + v_tax_amount + v_tip, 2);

  if v_total < 0 then
    raise exception 'Total de commande invalide';
  end if;

  -- Lock ingredients in deterministic order to avoid race conditions between two cashiers.
  for v_ingredient in
    select i.*
    from public.ingredients i
    where i.tenant_id = v_profile.tenant_id
      and i.id in (
        select ri.ingredient_id
        from public.recipe_items ri
        join jsonb_array_elements(p_items) x
          on (x.value->>'product_id')::uuid = ri.product_id
        where ri.tenant_id = v_profile.tenant_id
        group by ri.ingredient_id
      )
    order by i.id
    for update
  loop
    select coalesce(sum(ri.quantity * (x.value->>'quantity')::numeric), 0)
      into v_required
    from public.recipe_items ri
    join jsonb_array_elements(p_items) x
      on (x.value->>'product_id')::uuid = ri.product_id
    where ri.ingredient_id = v_ingredient.id
      and ri.tenant_id = v_profile.tenant_id;

    if v_required > v_ingredient.quantity then
      raise exception 'Stock insuffisant pour % : disponible %, nécessaire % %',
        v_ingredient.name,
        trim(to_char(v_ingredient.quantity, 'FM999999990.###')),
        trim(to_char(v_required, 'FM999999990.###')),
        v_ingredient.unit;
    end if;
  end loop;

  if p_table_id is not null then
    select name into v_table_name
    from public.restaurant_tables
    where id = p_table_id and tenant_id = v_profile.tenant_id;
  end if;

  insert into public.orders (
    order_number, table_id, table_name, server_id, server_name, cash_session_id,
    status, subtotal, discount, tax_rate, tax_amount, tip, total
  ) values (
    p_order_number, p_table_id, v_table_name, v_user_id, v_profile.full_name, p_cash_session_id,
    'paid', v_subtotal, v_discount, v_tax_rate, v_tax_amount, v_tip, v_total
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and tenant_id = v_profile.tenant_id;

    v_qty := (v_item->>'quantity')::integer;

    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price, unit_cost, cost_total, status, notes
    ) values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_qty,
      v_product.price,
      v_product.price * v_qty,
      v_product.cost,
      round(v_product.cost * v_qty, 2),
      'served',
      nullif(v_item->>'notes', '')
    );
  end loop;

  insert into public.payments (order_id, method, amount, tip)
  values (v_order.id, p_method, v_total, v_tip);

  -- Consume ingredients according to each product's recipe.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    for v_ingredient in
      select i.*
      from public.ingredients i
      join public.recipe_items ri on ri.ingredient_id = i.id
      where ri.product_id = (v_item->>'product_id')::uuid
        and ri.tenant_id = v_profile.tenant_id
        and i.tenant_id = v_profile.tenant_id
      order by i.id
    loop
      select ri.quantity * v_qty into v_required
      from public.recipe_items ri
      where ri.product_id = (v_item->>'product_id')::uuid
        and ri.ingredient_id = v_ingredient.id
        and ri.tenant_id = v_profile.tenant_id;

      update public.ingredients
      set quantity = quantity - v_required
      where id = v_ingredient.id;

      insert into public.stock_movements (
        ingredient_id, ingredient_name, type, cause, quantity, unit_cost, reference, user_name
      ) values (
        v_ingredient.id,
        v_ingredient.name,
        'out',
        'sale',
        -v_required,
        v_ingredient.cost_per_unit,
        'Commande #' || v_order.order_number,
        v_profile.full_name
      );
    end loop;
  end loop;

  if p_table_id is not null then
    update public.restaurant_tables
    set status = 'cleaning'
    where id = p_table_id and tenant_id = v_profile.tenant_id;
  end if;

  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, details
  ) values (
    v_user_id,
    v_profile.full_name,
    'create_order',
    'order',
    v_order.id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'total', v_order.total,
      'method', p_method,
      'items', jsonb_array_length(p_items),
      'stock_consumed', true
    )
  );

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.checkout_order_with_stock(integer, uuid, uuid, text, numeric, numeric, numeric, jsonb) from public;
grant execute on function public.checkout_order_with_stock(integer, uuid, uuid, text, numeric, numeric, numeric, jsonb) to authenticated;
