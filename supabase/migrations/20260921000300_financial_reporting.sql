-- Financial reporting: snapshot recipe cost at sale time so historical margins remain accurate.
alter table public.order_items
  add column if not exists unit_cost numeric(10,2) not null default 0,
  add column if not exists cost_total numeric(10,2) not null default 0;

-- Backfill older rows when possible from the current product cost. This is only a fallback;
-- new sales always store the exact recipe cost used at checkout.
update public.order_items oi
set unit_cost = coalesce(p.cost, 0),
    cost_total = round(oi.quantity * coalesce(p.cost, 0), 2)
from public.products p
where oi.product_id = p.id
  and (oi.unit_cost = 0 and oi.cost_total = 0);

-- Helper for dashboards and reports. COGS is based on the historical snapshot in order_items.
create or replace function public.get_financial_summary(p_start timestamptz, p_end timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_revenue numeric(14,2) := 0;
  v_cogs numeric(14,2) := 0;
  v_expenses numeric(14,2) := 0;
  v_orders integer := 0;
begin
  select tenant_id into v_tenant from public.profiles where id = auth.uid() and active = true;
  if v_tenant is null then raise exception 'Utilisateur non autorisé'; end if;

  select count(*), coalesce(sum(total),0)
    into v_orders, v_revenue
  from public.orders
  where tenant_id = v_tenant and status = 'paid'
    and created_at >= p_start and created_at < p_end;

  select coalesce(sum(oi.cost_total),0)
    into v_cogs
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.tenant_id = v_tenant and o.status = 'paid'
    and o.created_at >= p_start and o.created_at < p_end
    and oi.status <> 'cancelled';

  select coalesce(sum(amount),0)
    into v_expenses
  from public.expenses
  where tenant_id = v_tenant and expense_date >= p_start::date and expense_date < (p_end::date + 1);

  return jsonb_build_object(
    'orders', v_orders,
    'revenue', round(v_revenue,2),
    'cogs', round(v_cogs,2),
    'gross_profit', round(v_revenue - v_cogs,2),
    'expenses', round(v_expenses,2),
    'net_profit', round(v_revenue - v_cogs - v_expenses,2),
    'food_cost_percent', case when v_revenue > 0 then round((v_cogs / v_revenue) * 100,2) else 0 end,
    'gross_margin_percent', case when v_revenue > 0 then round(((v_revenue - v_cogs) / v_revenue) * 100,2) else 0 end
  );
end;
$$;

revoke all on function public.get_financial_summary(timestamptz,timestamptz) from public;
grant execute on function public.get_financial_summary(timestamptz,timestamptz) to authenticated;
