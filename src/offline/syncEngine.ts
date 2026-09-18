import { supabase } from '@/lib/supabase';
import { offlineDb, SyncOperation } from './offlineDb';

let running = false;
let timer: number | undefined;
const ALLOWED_RESOURCES = new Set(['categories','products','ingredients','recipe_items','restaurant_tables','reservations','cash_sessions','orders','order_items','payments','suppliers','purchase_orders','purchase_order_items','stock_movements','expenses','attendance','audit_logs','profiles']);

function isRetryable(op: SyncOperation) {
  return op.status !== 'error' || op.attempts < 8;
}

export async function syncPending(): Promise<void> {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) return;
    const queue = (await offlineDb.listQueue()).sort((a,b) => a.created_at.localeCompare(b.created_at));
    for (const op of queue) {
      if (!isRetryable(op)) continue;
      if (!ALLOWED_RESOURCES.has(op.resource)) {
        await offlineDb.enqueue({...op, status:'error', error:`Ressource non autorisée: ${op.resource}`});
        continue;
      }
      await offlineDb.enqueue({...op, status:'syncing', error: undefined});
      try {
        let result;
        if (op.type === 'HTTP') {
          const raw = op.payload as {url:string;method:string;headers:Record<string,string>;body?:string};
          const session = (await supabase.auth.getSession()).data.session;
          result = await fetch(raw.url, { method: raw.method, headers: { ...raw.headers, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: raw.body });
        } else {
          const table = (supabase as any).from(op.resource);
          result = op.type === 'DELETE'
            ? await table.delete().eq('id', (op.payload as {id:string}).id)
            : await table.upsert(op.payload, {onConflict:'id'});
        }
        if (result.error) throw result.error;
        await offlineDb.remove(op.operation_id);
      } catch (error) {
        await offlineDb.enqueue({...op, status:'error', attempts:op.attempts+1, error:error instanceof Error ? error.message : String(error)});
      }
    }
    await offlineDb.setMeta('lastSync', new Date().toISOString());
  } finally { running = false; }
}

export function startSync(): () => void {
  const onOnline = () => window.setTimeout(() => void syncPending(), 300);
  window.addEventListener('online', onOnline);
  if (timer === undefined) timer = window.setInterval(() => void syncPending(), 30000);
  void syncPending();
  return () => { window.removeEventListener('online', onOnline); if (timer !== undefined) window.clearInterval(timer); timer = undefined; };
}

export async function queueMutation(type: SyncOperation['type'], resource: string, payload: Record<string, unknown>) {
  const id = String(payload.id ?? crypto.randomUUID());
  const value = {...payload, id};
  const operation: SyncOperation = {operation_id:crypto.randomUUID(), type, resource, payload:value, local_id:id, created_at:new Date().toISOString(), attempts:0, status:'pending'};
  await offlineDb.putRecord(`${resource}:${id}`, value);
  await offlineDb.enqueue(operation);
  if (navigator.onLine) void syncPending();
  return value;
}
