-- Idempotency ledger for future transactional sync RPCs.
create table if not exists public.sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  resource text not null,
  payload jsonb not null,
  status text not null default 'processed',
  created_at timestamptz not null default now(),
  processed_at timestamptz not null default now()
);
alter table public.sync_operations enable row level security;
drop policy if exists "sync operations own rows" on public.sync_operations;
create policy "sync operations own rows" on public.sync_operations for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create unique index if not exists sync_operations_user_operation on public.sync_operations(user_id,operation_id);
