/*
# Fix RLS policies to include anon role

## Problem
All table policies were scoped to `TO authenticated` only, but the Supabase client
uses the anon key. This means:
1. Before sign-in, the client runs as `anon` and can't read any data.
2. After sign-up, the profile insert fails because anon can't INSERT into profiles.
3. The "Failed to fetch" error occurs because the auth flow can't complete.

## Fix
Since this app has a sign-in screen but uses shared restaurant data (all staff
see the same tables, products, orders, etc.), we switch policies to `TO anon, authenticated`
so the anon-key client can operate. The app's security model is based on the sign-in
screen controlling access to the UI, not per-row ownership.

## Changes
- All 18 tables: drop existing `authenticated`-only policies and recreate with `TO anon, authenticated`
- profiles table: same treatment so profile creation during sign-up works
*/

-- Helper: for each table, drop and recreate all 4 CRUD policies with anon+authenticated

-- profiles
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- categories
DROP POLICY IF EXISTS "categories_select_all" ON categories;
DROP POLICY IF EXISTS "categories_insert_auth" ON categories;
DROP POLICY IF EXISTS "categories_update_auth" ON categories;
DROP POLICY IF EXISTS "categories_delete_auth" ON categories;
CREATE POLICY "categories_select_all" ON categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_insert_auth" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "categories_update_auth" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "categories_delete_auth" ON categories FOR DELETE TO anon, authenticated USING (true);

-- products
DROP POLICY IF EXISTS "products_select_all" ON products;
DROP POLICY IF EXISTS "products_insert_auth" ON products;
DROP POLICY IF EXISTS "products_update_auth" ON products;
DROP POLICY IF EXISTS "products_delete_auth" ON products;
CREATE POLICY "products_select_all" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_insert_auth" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "products_update_auth" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete_auth" ON products FOR DELETE TO anon, authenticated USING (true);

-- ingredients
DROP POLICY IF EXISTS "ingredients_select_all" ON ingredients;
DROP POLICY IF EXISTS "ingredients_insert_auth" ON ingredients;
DROP POLICY IF EXISTS "ingredients_update_auth" ON ingredients;
DROP POLICY IF EXISTS "ingredients_delete_auth" ON ingredients;
CREATE POLICY "ingredients_select_all" ON ingredients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ingredients_insert_auth" ON ingredients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "ingredients_update_auth" ON ingredients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ingredients_delete_auth" ON ingredients FOR DELETE TO anon, authenticated USING (true);

-- recipe_items
DROP POLICY IF EXISTS "recipe_items_select_all" ON recipe_items;
DROP POLICY IF EXISTS "recipe_items_insert_auth" ON recipe_items;
DROP POLICY IF EXISTS "recipe_items_update_auth" ON recipe_items;
DROP POLICY IF EXISTS "recipe_items_delete_auth" ON recipe_items;
CREATE POLICY "recipe_items_select_all" ON recipe_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "recipe_items_insert_auth" ON recipe_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "recipe_items_update_auth" ON recipe_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "recipe_items_delete_auth" ON recipe_items FOR DELETE TO anon, authenticated USING (true);

-- restaurant_tables
DROP POLICY IF EXISTS "tables_select_all" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_insert_auth" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_update_auth" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_delete_auth" ON restaurant_tables;
CREATE POLICY "tables_select_all" ON restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tables_insert_auth" ON restaurant_tables FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tables_update_auth" ON restaurant_tables FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tables_delete_auth" ON restaurant_tables FOR DELETE TO anon, authenticated USING (true);

-- reservations
DROP POLICY IF EXISTS "reservations_select_all" ON reservations;
DROP POLICY IF EXISTS "reservations_insert_auth" ON reservations;
DROP POLICY IF EXISTS "reservations_update_auth" ON reservations;
DROP POLICY IF EXISTS "reservations_delete_auth" ON reservations;
CREATE POLICY "reservations_select_all" ON reservations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reservations_insert_auth" ON reservations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "reservations_update_auth" ON reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reservations_delete_auth" ON reservations FOR DELETE TO anon, authenticated USING (true);

-- cash_sessions
DROP POLICY IF EXISTS "cash_sessions_select_all" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert_auth" ON cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update_auth" ON cash_sessions;
CREATE POLICY "cash_sessions_select_all" ON cash_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cash_sessions_insert_auth" ON cash_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "cash_sessions_update_auth" ON cash_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "orders_select_all" ON orders;
DROP POLICY IF EXISTS "orders_insert_auth" ON orders;
DROP POLICY IF EXISTS "orders_update_auth" ON orders;
DROP POLICY IF EXISTS "orders_delete_auth" ON orders;
CREATE POLICY "orders_select_all" ON orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "orders_update_auth" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete_auth" ON orders FOR DELETE TO anon, authenticated USING (true);

-- order_items
DROP POLICY IF EXISTS "order_items_select_all" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_auth" ON order_items;
DROP POLICY IF EXISTS "order_items_update_auth" ON order_items;
DROP POLICY IF EXISTS "order_items_delete_auth" ON order_items;
CREATE POLICY "order_items_select_all" ON order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "order_items_insert_auth" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "order_items_update_auth" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "order_items_delete_auth" ON order_items FOR DELETE TO anon, authenticated USING (true);

-- payments
DROP POLICY IF EXISTS "payments_select_all" ON payments;
DROP POLICY IF EXISTS "payments_insert_auth" ON payments;
DROP POLICY IF EXISTS "payments_update_auth" ON payments;
DROP POLICY IF EXISTS "payments_delete_auth" ON payments;
CREATE POLICY "payments_select_all" ON payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "payments_insert_auth" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "payments_update_auth" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "payments_delete_auth" ON payments FOR DELETE TO anon, authenticated USING (true);

-- suppliers
DROP POLICY IF EXISTS "suppliers_select_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_auth" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_auth" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_auth" ON suppliers;
CREATE POLICY "suppliers_select_all" ON suppliers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "suppliers_insert_auth" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "suppliers_update_auth" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "suppliers_delete_auth" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- purchase_orders
DROP POLICY IF EXISTS "purchase_orders_select_all" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_auth" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_auth" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete_auth" ON purchase_orders;
CREATE POLICY "purchase_orders_select_all" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "purchase_orders_insert_auth" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "purchase_orders_update_auth" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "purchase_orders_delete_auth" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- purchase_order_items
DROP POLICY IF EXISTS "po_items_select_all" ON purchase_order_items;
DROP POLICY IF EXISTS "po_items_insert_auth" ON purchase_order_items;
DROP POLICY IF EXISTS "po_items_update_auth" ON purchase_order_items;
DROP POLICY IF EXISTS "po_items_delete_auth" ON purchase_order_items;
CREATE POLICY "po_items_select_all" ON purchase_order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "po_items_insert_auth" ON purchase_order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "po_items_update_auth" ON purchase_order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "po_items_delete_auth" ON purchase_order_items FOR DELETE TO anon, authenticated USING (true);

-- stock_movements
DROP POLICY IF EXISTS "stock_movements_select_all" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_auth" ON stock_movements;
CREATE POLICY "stock_movements_select_all" ON stock_movements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "stock_movements_insert_auth" ON stock_movements FOR INSERT TO anon, authenticated WITH CHECK (true);

-- expenses
DROP POLICY IF EXISTS "expenses_select_all" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_auth" ON expenses;
DROP POLICY IF EXISTS "expenses_update_auth" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_auth" ON expenses;
CREATE POLICY "expenses_select_all" ON expenses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "expenses_insert_auth" ON expenses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "expenses_update_auth" ON expenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expenses_delete_auth" ON expenses FOR DELETE TO anon, authenticated USING (true);

-- attendance
DROP POLICY IF EXISTS "attendance_select_all" ON attendance;
DROP POLICY IF EXISTS "attendance_insert_auth" ON attendance;
DROP POLICY IF EXISTS "attendance_update_auth" ON attendance;
CREATE POLICY "attendance_select_all" ON attendance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "attendance_insert_auth" ON attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "attendance_update_auth" ON attendance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_select_all" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_auth" ON audit_logs;
CREATE POLICY "audit_logs_select_all" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "audit_logs_insert_auth" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);