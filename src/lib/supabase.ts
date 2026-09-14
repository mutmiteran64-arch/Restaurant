import { createClient } from '@supabase/supabase-js';
import { enqueueHttp } from '@/offline/httpQueue';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError = !configuredSupabaseUrl || !configuredSupabaseAnonKey
  ? 'Configuration Supabase absente. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans GitHub → Settings → Secrets and variables → Actions.'
  : null;

// Valeurs de secours uniquement pour empêcher une page blanche lorsque les secrets
// GitHub ne sont pas encore configurés. Elles ne permettent aucune connexion.
const supabaseUrl = configuredSupabaseUrl || 'https://missing-supabase-config.invalid';
const supabaseAnonKey = configuredSupabaseAnonKey || 'missing-supabase-anon-key';

const offlineFetch: typeof fetch = async (input, init = {}) => {
  try { return await fetch(input, init); }
  catch (error) { return enqueueHttp(String(input), init, error); }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: offlineFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function getProductImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;

  const fileName = imageUrl.split('/').pop()?.split('?')[0];
  if (!fileName) return null;

  return supabase.storage
    .from('product-images')
    .getPublicUrl(decodeURIComponent(fileName)).data.publicUrl;
}

export type Role = 'owner' | 'manager' | 'cashier' | 'server' | 'chef' | 'storekeeper' | 'accountant';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  tenant_id: string;
  active: boolean;
  hire_date: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  available: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_per_unit: number;
  supplier_id: string | null;
  created_at: string;
};

export type RecipeItem = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  created_at: string;
};

export type RestaurantTable = {
  id: string;
  name: string;
  zone: string;
  capacity: number;
  status: 'free' | 'occupied' | 'reserved' | 'waiting' | 'cleaning';
  pos_x: number;
  pos_y: number;
  shape: 'round' | 'square' | 'rect';
  created_at: string;
};

export type Reservation = {
  id: string;
  table_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: number;
  table_id: string | null;
  table_name: string | null;
  server_id: string | null;
  server_name: string | null;
  cash_session_id: string | null;
  status: 'open' | 'sent' | 'paid' | 'cancelled' | 'refunded';
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  tip: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  method: 'cash' | 'card' | 'mobile_money' | 'mixed';
  amount: number;
  tip: number;
  created_at: string;
};

export type CashSession = {
  id: string;
  user_id: string;
  user_name: string;
  opening_balance: number;
  closing_balance: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  note: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: number;
  supplier_id: string | null;
  supplier_name: string | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  ingredient_id: string | null;
  ingredient_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type StockMovement = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  type: 'in' | 'out' | 'adjust' | 'waste' | 'transfer';
  cause: 'sale' | 'purchase' | 'waste' | 'breakage' | 'transfer' | 'consumption' | 'adjustment' | 'manual';
  quantity: number;
  unit_cost: number;
  reference: string | null;
  user_name: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_by: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  user_id: string;
  user_name: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  status: 'present' | 'late' | 'absent' | 'leave';
  created_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
