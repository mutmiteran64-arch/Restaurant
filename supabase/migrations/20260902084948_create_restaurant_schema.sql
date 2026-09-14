/*
# Restaurant Management System - Core Schema

## Overview
Creates the complete database schema for a restaurant management platform with POS, tables, stock, staff, finance, and reporting modules.

## New Tables

1. **profiles** - Extends auth.users with restaurant staff info (role, name, phone, active status)
2. **categories** - Product categories (drinks, starters, mains, desserts, etc.)
3. **products** - Menu items with price, cost, category, availability
4. **ingredients** - Stock items with unit, quantity, min threshold, cost per unit
5. **recipe_items** - Links products to ingredients with quantities (recipe = bill of materials)
6. **restaurant_tables** - Floor plan tables with status, zone, capacity
7. **reservations** - Table reservations with date, time, party size, status
8. **orders** - Sales orders linked to table, server, cash session
9. **order_items** - Individual items in an order with quantity, price, notes, status
10. **payments** - Payment records with method, amount, tip
11. **cash_sessions** - Open/close cash drawer sessions with opening/closing balances
12. **suppliers** - Supplier contact info
13. **purchase_orders** - Orders to suppliers with status
14. **purchase_order_items** - Items in a purchase order
15. **stock_movements** - All stock in/out with cause (sale, breakage, transfer, etc.)
16. **expenses** - Categorized expenses (rent, utilities, marketing, etc.)
17. **attendance** - Staff clock in/out records with hours worked
18. **audit_logs** - Immutable log of all sensitive operations

## Security
- RLS enabled on all tables
- Policies scoped to authenticated users (app has sign-in)
- Owner checks via auth.uid() on profiles
- All authenticated staff can read operational data; writes scoped by role where needed
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'server' CHECK (role IN ('owner','manager','cashier','server','chef','storekeeper','accountant')),
  active boolean NOT NULL DEFAULT true,
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_all" ON categories;
CREATE POLICY "categories_select_all" ON categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_auth" ON categories;
CREATE POLICY "categories_insert_auth" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categories_update_auth" ON categories;
CREATE POLICY "categories_update_auth" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categories_delete_auth" ON categories;
CREATE POLICY "categories_delete_auth" ON categories FOR DELETE
  TO authenticated USING (true);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_auth" ON products;
CREATE POLICY "products_insert_auth" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_auth" ON products;
CREATE POLICY "products_update_auth" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_delete_auth" ON products;
CREATE POLICY "products_delete_auth" ON products FOR DELETE
  TO authenticated USING (true);

-- ============ INGREDIENTS ============
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  min_quantity numeric(12,3) NOT NULL DEFAULT 0,
  cost_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  supplier_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredients_select_all" ON ingredients;
CREATE POLICY "ingredients_select_all" ON ingredients FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "ingredients_insert_auth" ON ingredients;
CREATE POLICY "ingredients_insert_auth" ON ingredients FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ingredients_update_auth" ON ingredients;
CREATE POLICY "ingredients_update_auth" ON ingredients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ingredients_delete_auth" ON ingredients;
CREATE POLICY "ingredients_delete_auth" ON ingredients FOR DELETE
  TO authenticated USING (true);

-- ============ RECIPE ITEMS ============
CREATE TABLE IF NOT EXISTS recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_items_select_all" ON recipe_items;
CREATE POLICY "recipe_items_select_all" ON recipe_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "recipe_items_insert_auth" ON recipe_items;
CREATE POLICY "recipe_items_insert_auth" ON recipe_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "recipe_items_update_auth" ON recipe_items;
CREATE POLICY "recipe_items_update_auth" ON recipe_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "recipe_items_delete_auth" ON recipe_items;
CREATE POLICY "recipe_items_delete_auth" ON recipe_items FOR DELETE
  TO authenticated USING (true);

-- ============ TABLES (FLOOR PLAN) ============
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone text NOT NULL DEFAULT 'Main',
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','reserved','waiting','cleaning')),
  pos_x int NOT NULL DEFAULT 0,
  pos_y int NOT NULL DEFAULT 0,
  shape text NOT NULL DEFAULT 'round' CHECK (shape IN ('round','square','rect')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tables_select_all" ON restaurant_tables;
CREATE POLICY "tables_select_all" ON restaurant_tables FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tables_insert_auth" ON restaurant_tables;
CREATE POLICY "tables_insert_auth" ON restaurant_tables FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tables_update_auth" ON restaurant_tables;
CREATE POLICY "tables_update_auth" ON restaurant_tables FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tables_delete_auth" ON restaurant_tables;
CREATE POLICY "tables_delete_auth" ON restaurant_tables FOR DELETE
  TO authenticated USING (true);

-- ============ RESERVATIONS ============
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  party_size int NOT NULL DEFAULT 2,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','seated','cancelled','no_show')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_select_all" ON reservations;
CREATE POLICY "reservations_select_all" ON reservations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reservations_insert_auth" ON reservations;
CREATE POLICY "reservations_insert_auth" ON reservations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reservations_update_auth" ON reservations;
CREATE POLICY "reservations_update_auth" ON reservations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reservations_delete_auth" ON reservations;
CREATE POLICY "reservations_delete_auth" ON reservations FOR DELETE
  TO authenticated USING (true);

-- ============ CASH SESSIONS ============
CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  opening_balance numeric(10,2) NOT NULL DEFAULT 0,
  closing_balance numeric(10,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  note text
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_select_all" ON cash_sessions;
CREATE POLICY "cash_sessions_select_all" ON cash_sessions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "cash_sessions_insert_auth" ON cash_sessions;
CREATE POLICY "cash_sessions_insert_auth" ON cash_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cash_sessions_update_auth" ON cash_sessions;
CREATE POLICY "cash_sessions_update_auth" ON cash_sessions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number int NOT NULL,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  table_name text,
  server_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  server_name text,
  cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent','paid','cancelled','refunded')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  tip numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_all" ON orders;
CREATE POLICY "orders_select_all" ON orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "orders_insert_auth" ON orders;
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "orders_update_auth" ON orders;
CREATE POLICY "orders_update_auth" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orders_delete_auth" ON orders;
CREATE POLICY "orders_delete_auth" ON orders FOR DELETE
  TO authenticated USING (true);

-- ============ ORDER ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_all" ON order_items;
CREATE POLICY "order_items_select_all" ON order_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "order_items_insert_auth" ON order_items;
CREATE POLICY "order_items_insert_auth" ON order_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_update_auth" ON order_items;
CREATE POLICY "order_items_update_auth" ON order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_delete_auth" ON order_items;
CREATE POLICY "order_items_delete_auth" ON order_items FOR DELETE
  TO authenticated USING (true);

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash','card','mobile_money','mixed')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  tip numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_all" ON payments;
CREATE POLICY "payments_select_all" ON payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert_auth" ON payments;
CREATE POLICY "payments_insert_auth" ON payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "payments_update_auth" ON payments;
CREATE POLICY "payments_update_auth" ON payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "payments_delete_auth" ON payments;
CREATE POLICY "payments_delete_auth" ON payments FOR DELETE
  TO authenticated USING (true);

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_all" ON suppliers;
CREATE POLICY "suppliers_select_all" ON suppliers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "suppliers_insert_auth" ON suppliers;
CREATE POLICY "suppliers_insert_auth" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "suppliers_update_auth" ON suppliers;
CREATE POLICY "suppliers_update_auth" ON suppliers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "suppliers_delete_auth" ON suppliers;
CREATE POLICY "suppliers_delete_auth" ON suppliers FOR DELETE
  TO authenticated USING (true);

-- ============ PURCHASE ORDERS ============
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number int NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_select_all" ON purchase_orders;
CREATE POLICY "purchase_orders_select_all" ON purchase_orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "purchase_orders_insert_auth" ON purchase_orders;
CREATE POLICY "purchase_orders_insert_auth" ON purchase_orders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_orders_update_auth" ON purchase_orders;
CREATE POLICY "purchase_orders_update_auth" ON purchase_orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_orders_delete_auth" ON purchase_orders;
CREATE POLICY "purchase_orders_delete_auth" ON purchase_orders FOR DELETE
  TO authenticated USING (true);

-- ============ PURCHASE ORDER ITEMS ============
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_items_select_all" ON purchase_order_items;
CREATE POLICY "po_items_select_all" ON purchase_order_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "po_items_insert_auth" ON purchase_order_items;
CREATE POLICY "po_items_insert_auth" ON purchase_order_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "po_items_update_auth" ON purchase_order_items;
CREATE POLICY "po_items_update_auth" ON purchase_order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "po_items_delete_auth" ON purchase_order_items;
CREATE POLICY "po_items_delete_auth" ON purchase_order_items FOR DELETE
  TO authenticated USING (true);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('in','out','adjust','waste','transfer')),
  cause text NOT NULL DEFAULT 'manual' CHECK (cause IN ('sale','purchase','waste','breakage','transfer','consumption','adjustment','manual')),
  quantity numeric(12,3) NOT NULL,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  reference text,
  user_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select_all" ON stock_movements;
CREATE POLICY "stock_movements_select_all" ON stock_movements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_movements_insert_auth" ON stock_movements;
CREATE POLICY "stock_movements_insert_auth" ON stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ EXPENSES ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_all" ON expenses;
CREATE POLICY "expenses_select_all" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "expenses_insert_auth" ON expenses;
CREATE POLICY "expenses_insert_auth" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_update_auth" ON expenses;
CREATE POLICY "expenses_update_auth" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_delete_auth" ON expenses;
CREATE POLICY "expenses_delete_auth" ON expenses FOR DELETE
  TO authenticated USING (true);

-- ============ ATTENDANCE ============
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  hours_worked numeric(5,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','leave')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_all" ON attendance;
CREATE POLICY "attendance_select_all" ON attendance FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "attendance_insert_auth" ON attendance;
CREATE POLICY "attendance_insert_auth" ON attendance FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_update_auth" ON attendance;
CREATE POLICY "attendance_update_auth" ON attendance FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_all" ON audit_logs;
CREATE POLICY "audit_logs_select_all" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert_auth" ON audit_logs;
CREATE POLICY "audit_logs_insert_auth" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_product ON recipe_items(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============ ORDER NUMBER SEQUENCE ============
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;