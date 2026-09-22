import { useEffect, useState, useCallback } from 'react';
import { supabase, getProductImageUrl } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatCurrencyUSD } from '@/lib/utils';
import type { Product, Category, Order, RestaurantTable, CashSession } from '@/lib/supabase';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Receipt,
  Printer,
  Pencil,
  Check,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

type CartItem = {
  product: Product;
  quantity: number;
  notes: string;
};

export default function POS() {
  const { profile, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockInfo, setStockInfo] = useState<Record<string, { tracked: boolean; available: number }>>({});
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [tip, setTip] = useState(0);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'mobile_money' | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<{ id: string; product_name: string; quantity: number; unit_price: number; total_price: number; notes: string | null }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) checkCashSession();
    else setSessionChecked(true);
  }, [user]);

  async function loadData() {
    const [cats, prods, tbls, recipesResult, ingredientsResult] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*').eq('available', true).order('name'),
      supabase.from('restaurant_tables').select('*').order('name'),
      supabase.from('recipe_items').select('product_id, ingredient_id, quantity'),
      supabase.from('ingredients').select('id, quantity'),
    ]);
    const nextProducts = prods.data ?? [];
    setCategories(cats.data ?? []);
    setProducts(nextProducts);
    setTables(tbls.data ?? []);

    const ingredientStock = new Map((ingredientsResult.data ?? []).map((i) => [i.id, Number(i.quantity)]));
    const recipesByProduct = new Map<string, { ingredient_id: string; quantity: number }[]>();
    for (const recipe of recipesResult.data ?? []) {
      const list = recipesByProduct.get(recipe.product_id) ?? [];
      list.push({ ingredient_id: recipe.ingredient_id, quantity: Number(recipe.quantity) });
      recipesByProduct.set(recipe.product_id, list);
    }
    const nextStockInfo: Record<string, { tracked: boolean; available: number }> = {};
    for (const product of nextProducts) {
      const recipe = recipesByProduct.get(product.id) ?? [];
      if (recipe.length === 0) {
        nextStockInfo[product.id] = { tracked: false, available: Infinity };
      } else {
        const possible = recipe.map((r) => {
          const required = r.quantity;
          return required > 0 ? Math.floor((ingredientStock.get(r.ingredient_id) ?? 0) / required) : Infinity;
        });
        nextStockInfo[product.id] = { tracked: true, available: Math.max(0, Math.min(...possible)) };
      }
    }
    setStockInfo(nextStockInfo);
    if (cats.data && cats.data.length > 0 && !selectedCategory) setSelectedCategory(cats.data[0].id);
  }

  async function checkCashSession() {
    if (!user) {
      setSessionChecked(true);
      return;
    }
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();
    setCashSession(data as CashSession | null);
    setSessionChecked(true);
  }

  async function openCashSession() {
    if (!user || !profile) return;
    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        user_id: user.id,
        user_name: profile.full_name,
        opening_balance: 0,
        status: 'open',
      })
      .select()
      .single();
    if (!error && data) setCashSession(data as CashSession);
    loadRecentOrders();
  }

  async function loadRecentOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentOrders(data as Order[] ?? []);
  }

  async function openOrderEditor(order: Order) {
    setEditingOrder(order);
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    setOrderItems(data ?? []);
  }

  async function saveOrderEdit() {
    if (!editingOrder) return;
    const newSubtotal = orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const newTotal = newSubtotal - editingOrder.discount + editingOrder.tax_amount + editingOrder.tip;

    await supabase.from('orders').update({
      subtotal: newSubtotal,
      total: newTotal,
    }).eq('id', editingOrder.id);

    for (const item of orderItems) {
      await supabase.from('order_items').update({
        quantity: item.quantity,
        total_price: item.unit_price * item.quantity,
      }).eq('id', item.id);
    }

    setEditingOrder(null);
    loadRecentOrders();
  }

  async function printReceipt(order: Order) {
    const { data } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, unit_price, total_price, notes')
      .eq('order_id', order.id);
    const items = data ?? [];
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Recu #${order.order_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; width: 280px; padding: 10px; color: #000; }
        .center { text-align: center; }
        .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .title { font-size: 18px; font-weight: bold; }
        .info { font-size: 12px; margin: 2px 0; }
        .items { margin: 8px 0; }
        .item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
        .item-name { flex: 1; }
        .item-qty { width: 40px; text-align: center; }
        .item-price { width: 70px; text-align: right; }
        .totals { border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; }
        .total-line { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
        .total-bold { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
        .footer { text-align: center; font-size: 11px; margin-top: 12px; border-top: 2px dashed #000; padding-top: 8px; }
        @media print { body { width: auto; } }
      </style></head><body>
        <div class="center header">
          <div class="title">RESTAURANT</div>
          <div class="info">Recu de commande</div>
          <div class="info">#${order.order_number}</div>
          <div class="info">${new Date(order.created_at).toLocaleString('fr-FR')}</div>
          ${order.table_name ? `<div class="info">Table: ${order.table_name}</div>` : ''}
          <div class="info">Serveur: ${order.server_name ?? ''}</div>
        </div>
        <div class="items">
          <div class="item" style="font-weight:bold;border-bottom:1px dashed #000;padding-bottom:4px;">
            <span class="item-name">Article</span>
            <span class="item-qty">Qte</span>
            <span class="item-price">Prix</span>
          </div>
          ${items.map(i => `
          <div class="item">
            <span class="item-name">${i.product_name}</span>
            <span class="item-qty">${i.quantity}</span>
            <span class="item-price">${formatCurrency(i.unit_price * i.quantity)}</span>
          </div>`).join('')}
        </div>
        <div class="totals">
          <div class="total-line"><span>Sous-total</span><span>${formatCurrency(order.subtotal)}</span></div>
          ${order.discount > 0 ? `<div class="total-line"><span>Remise</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
          ${order.tax_amount > 0 ? `<div class="total-line"><span>Taxe</span><span>${formatCurrency(order.tax_amount)}</span></div>` : ''}
          ${order.tip > 0 ? `<div class="total-line"><span>Pourboire</span><span>${formatCurrency(order.tip)}</span></div>` : ''}
          <div class="total-line total-bold"><span>TOTAL</span><span>${formatCurrency(order.total)}</span></div>
        </div>
        <div class="footer">
          Merci de votre visite !<br/>
          ${new Date().toLocaleString('fr-FR')}
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  }

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = useCallback((product: Product) => {
    const info = stockInfo[product.id];
    const currentQty = cart.find((c) => c.product.id === product.id)?.quantity ?? 0;
    if (info?.tracked && currentQty >= info.available) {
      setError(`Stock insuffisant pour ${product.name}`);
      return;
    }
    setError(null);
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => (c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { product, quantity: 1, notes: '' }];
    });
  }, [cart, stockInfo]);

  const updateQty = (productId: string, delta: number) => {
    if (delta > 0) {
      const info = stockInfo[productId];
      const currentQty = cart.find((c) => c.product.id === productId)?.quantity ?? 0;
      if (info?.tracked && currentQty >= info.available) {
        const product = products.find((p) => p.id === productId);
        setError(`Stock insuffisant pour ${product?.name ?? 'cet article'}`);
        return;
      }
    }
    setError(null);
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal - discount + taxAmount + tip;
  const changeDue = Math.max(0, amountReceived - total);

  async function handleCheckout(method: 'cash' | 'card' | 'mobile_money') {
    if (cart.length === 0 || !user || !profile) return;

    if (method === 'cash' && amountReceived < total) {
      setError('Le montant recu est insuffisant');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const orderNumber = Math.floor(Date.now() / 1000) % 100000;
      const { data, error: checkoutError } = await supabase.rpc('checkout_order_with_stock', {
        p_order_number: orderNumber,
        p_table_id: selectedTable,
        p_cash_session_id: cashSession?.id ?? null,
        p_method: method,
        p_discount: discount,
        p_tax_rate: taxRate,
        p_tip: tip,
        p_items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
          notes: c.notes || null,
        })),
      });

      if (checkoutError) throw checkoutError;
      if (!data) throw new Error('La commande n’a pas pu être enregistrée');

      const order = data as Order;
      setShowReceipt(order);
      setCart([]);
      setSelectedTable(null);
      setDiscount(0);
      setTaxRate(0);
      setTip(0);
      setAmountReceived(0);
      setSelectedPaymentMethod(null);
      await loadRecentOrders();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du traitement de la commande';
      setError(message.replace(/^.*?ERROR:\s*/i, ''));
    } finally {
      setSubmitting(false);
      setShowPayment(false);
    }
  }

  if (!sessionChecked) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!cashSession) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <Banknote className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-secondary-900 mb-2">Ouvrir la caisse</h2>
          <p className="text-sm text-secondary-500 mb-6">
            Vous devez ouvrir une session de caisse avant de prendre des commandes. Cela permet de suivre le fond de caisse et de faire la reconciliation en fin de service.
          </p>
          <button onClick={openCashSession} className="btn-primary w-full">
            <Banknote className="w-4 h-4" />
            Ouvrir la caisse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Product selection */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-secondary-100 bg-white">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              placeholder="Rechercher un produit..."
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={Boolean(stockInfo[product.id]?.tracked && stockInfo[product.id]?.available <= 0)}
                className="card p-4 text-left hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="aspect-square rounded-lg bg-secondary-100 mb-3 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={getProductImageUrl(product.image_url) ?? undefined}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent && !parent.querySelector('.img-fallback')) {
                          const fallback = document.createElement('span');
                          fallback.className = 'img-fallback text-2xl font-bold text-secondary-300';
                          fallback.textContent = product.name.charAt(0).toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-2xl font-bold text-secondary-300">
                      {product.name.charAt(0)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-secondary-900 line-clamp-2">{product.name}</p>
                <p className="text-lg font-bold text-primary-600 mt-1">{formatCurrency(product.price)}</p>
                {stockInfo[product.id]?.tracked && (
                  <p className={`text-xs mt-1 ${stockInfo[product.id].available <= 0 ? 'text-error-600 font-semibold' : stockInfo[product.id].available <= 3 ? 'text-warning-600 font-medium' : 'text-secondary-400'}`}>
                    {stockInfo[product.id].available <= 0 ? 'Rupture de stock' : `Stock disponible : ${stockInfo[product.id].available}`}
                  </p>
                )}
              </button>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-secondary-400">
              <Search className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Aucun produit trouve</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar - desktop */}
      <div className="hidden lg:flex w-96 flex-shrink-0 bg-white border-l border-secondary-100 flex-col">
        {cartPanel()}
      </div>

      {/* Cart sidebar - mobile drawer */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-secondary-950/40" onClick={() => setMobileCartOpen(false)} />
          <div className="relative w-full max-w-sm bg-white flex flex-col animate-slide-in-right ml-auto">
            <div className="flex items-center justify-between p-4 border-b border-secondary-100">
              <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {selectedTable
                  ? `Commande — ${tables.find((t) => t.id === selectedTable)?.name ?? 'Table'}`
                  : 'Commande — A emporter'}
              </h2>
              <button onClick={() => setMobileCartOpen(false)} className="text-secondary-400 hover:text-secondary-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {cartPanel()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile cart button */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-40 btn-primary shadow-lg shadow-primary-600/30 rounded-full px-5 py-3"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-semibold">{cart.length}</span>
          <span className="ml-1">{formatCurrency(total)}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
          <div className="card p-6 max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-secondary-900">Paiement</h2>
              <button onClick={() => { setShowPayment(false); setSelectedPaymentMethod(null); setAmountReceived(0); setError(null); }} className="text-secondary-400 hover:text-secondary-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-secondary-500">Montant a regler</p>
              <p className="text-4xl font-bold text-secondary-900 mt-1">{formatCurrency(total)}</p>
            </div>

            {error && (
              <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Payment method selection */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => { setSelectedPaymentMethod('cash'); setAmountReceived(total); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === 'cash'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-200 hover:border-primary-300'
                }`}
              >
                <Banknote className="w-6 h-6 text-accent-600" />
                <span className="text-sm font-medium">Espece</span>
              </button>
              <button
                onClick={() => { setSelectedPaymentMethod('card'); setAmountReceived(total); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === 'card'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-200 hover:border-primary-300'
                }`}
              >
                <CreditCard className="w-6 h-6 text-secondary-600" />
                <span className="text-sm font-medium">Carte</span>
              </button>
              <button
                onClick={() => { setSelectedPaymentMethod('mobile_money'); setAmountReceived(total); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === 'mobile_money'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-200 hover:border-primary-300'
                }`}
              >
                <Smartphone className="w-6 h-6 text-primary-600" />
                <span className="text-sm font-medium">Mobile</span>
              </button>
            </div>

            {/* Cash payment: amount received + change due */}
            {selectedPaymentMethod === 'cash' && (
              <div className="space-y-4 p-4 rounded-xl bg-secondary-50 border border-secondary-100">
                <div>
                  <label className="label">Montant recu du client</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountReceived || ''}
                    onChange={(e) => setAmountReceived(Math.max(0, Number(e.target.value)))}
                    className="input text-lg font-semibold text-center"
                    placeholder="0.00"
                  />
                  <div className="flex gap-2 mt-2">
                    {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20].map((amt, i) => (
                      <button
                        key={i}
                        onClick={() => setAmountReceived(amt)}
                        className="flex-1 py-1.5 text-xs font-medium rounded-md bg-white border border-secondary-200 hover:border-primary-400 hover:text-primary-600 transition-colors"
                      >
                        {formatCurrencyUSD(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-secondary-200">
                  <span className="text-sm font-medium text-secondary-600">Total commande</span>
                  <span className="text-sm font-bold text-secondary-900">{formatCurrency(total)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-secondary-200">
                  <span className="text-sm font-medium text-secondary-600">Montant recu</span>
                  <span className="text-sm font-bold text-secondary-900">{formatCurrency(amountReceived)}</span>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${changeDue > 0 ? 'bg-accent-50 border-accent-200' : 'bg-white border-secondary-200'}`}>
                  <span className="text-sm font-semibold text-secondary-700">Monnaie a rendre</span>
                  <span className={`text-lg font-bold ${changeDue > 0 ? 'text-accent-700' : 'text-secondary-900'}`}>
                    {formatCurrency(changeDue)}
                  </span>
                </div>

                <button
                  onClick={() => handleCheckout('cash')}
                  disabled={submitting || amountReceived < total}
                  className="btn-primary w-full"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Valider le paiement espece
                </button>
                {amountReceived < total && amountReceived > 0 && (
                  <p className="text-xs text-error-600 text-center">
                    Il manque {formatCurrency(total - amountReceived)}
                  </p>
                )}
              </div>
            )}

            {/* Card / Mobile: direct confirm */}
            {selectedPaymentMethod === 'card' && (
              <button
                onClick={() => handleCheckout('card')}
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Valider le paiement carte
              </button>
            )}
            {selectedPaymentMethod === 'mobile_money' && (
              <button
                onClick={() => handleCheckout('mobile_money')}
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Valider le paiement mobile
              </button>
            )}

            {!selectedPaymentMethod && (
              <p className="text-xs text-secondary-400 text-center">Selectionnez un mode de paiement</p>
            )}
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
          <div className="card p-6 max-w-sm w-full animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-accent-600" />
              </div>
              <h2 className="text-xl font-bold text-secondary-900">Commande finalisee</h2>
              <p className="text-sm text-secondary-500">Commande #{showReceipt.order_number}</p>
            </div>

            <div className="border border-dashed border-secondary-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-secondary-600">
                <span>Sous-total</span>
                <span>{formatCurrency(showReceipt.subtotal)}</span>
              </div>
              {showReceipt.discount > 0 && (
                <div className="flex justify-between text-secondary-600">
                  <span>Remise</span>
                  <span>-{formatCurrency(showReceipt.discount)}</span>
                </div>
              )}
              {showReceipt.tax_amount > 0 && (
                <div className="flex justify-between text-secondary-600">
                  <span>Taxe</span>
                  <span>{formatCurrency(showReceipt.tax_amount)}</span>
                </div>
              )}
              {showReceipt.tip > 0 && (
                <div className="flex justify-between text-secondary-600">
                  <span>Pourboire</span>
                  <span>{formatCurrency(showReceipt.tip)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-secondary-900 pt-2 border-t border-secondary-200">
                <span>Total</span>
                <span>{formatCurrency(showReceipt.total)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowReceipt(null)}
                className="btn-secondary flex-1"
              >
                <Receipt className="w-4 h-4" />
                Nouvelle commande
              </button>
              <button
                onClick={() => printReceipt(showReceipt)}
                className="btn-primary flex-1"
              >
                <Printer className="w-4 h-4" />
                Imprimer le recu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order history button */}
      <button
        onClick={() => { setShowOrderHistory(true); loadRecentOrders(); }}
        className="hidden lg:flex fixed top-20 right-4 z-30 items-center gap-2 px-3 py-2 rounded-lg bg-white border border-secondary-200 text-secondary-600 text-sm font-medium hover:bg-secondary-50 shadow-sm"
      >
        <Receipt className="w-4 h-4" />
        Commandes recentes
      </button>

      {/* Order history modal */}
      {showOrderHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
          <div className="card p-6 max-w-lg w-full animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-secondary-900">Commandes recentes</h2>
              <button onClick={() => setShowOrderHistory(false)} className="text-secondary-400 hover:text-secondary-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-secondary-400 text-center py-8">Aucune commande recente</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary-50 hover:bg-secondary-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-secondary-900">#{o.order_number} {o.table_name ? `- ${o.table_name}` : '- A emporter'}</p>
                      <p className="text-xs text-secondary-400">{formatCurrency(o.total)} - {new Date(o.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { openOrderEditor(o); setShowOrderHistory(false); }}
                        className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-200 hover:text-secondary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => printReceipt(o)}
                        className="p-1.5 rounded-md text-secondary-400 hover:bg-secondary-200 hover:text-secondary-600"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit order modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/40 p-4">
          <div className="card p-6 max-w-md w-full animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-secondary-900">Modifier commande #{editingOrder.order_number}</h2>
              <button onClick={() => setEditingOrder(null)} className="text-secondary-400 hover:text-secondary-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {orderItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-3 rounded-lg bg-secondary-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-secondary-400">{formatCurrency(item.unit_price)} l'unite</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                      className="w-7 h-7 rounded-md bg-white border border-secondary-200 flex items-center justify-center hover:bg-secondary-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                      className="w-7 h-7 rounded-md bg-white border border-secondary-200 flex items-center justify-center hover:bg-secondary-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-secondary-900 w-20 text-right">{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-secondary-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between font-bold text-secondary-900">
                <span>Nouveau total</span>
                <span>{formatCurrency(orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0) - editingOrder.discount + editingOrder.tax_amount + editingOrder.tip)}</span>
              </div>
            </div>
            <button onClick={saveOrderEdit} className="btn-primary w-full mt-4">
              <Check className="w-4 h-4" />
              Enregistrer les modifications
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function cartPanel() {
    return (
      <>
        <div className="p-4 border-b border-secondary-100">
          <div className="hidden lg:flex items-center justify-between mb-3">
            <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {selectedTable
                ? `Commande — ${tables.find((t) => t.id === selectedTable)?.name ?? 'Table'}`
                : 'Commande — A emporter'}
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-error-600 hover:underline">
                Tout effacer
              </button>
            )}
          </div>
          <select
            value={selectedTable ?? ''}
            onChange={(e) => setSelectedTable(e.target.value || null)}
            className="input"
          >
            <option value="">A emporter / Sans table</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.zone} ({t.capacity}p)
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-secondary-400">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Le panier est vide</p>
              <p className="text-xs mt-1">Cliquez sur un produit pour l'ajouter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-secondary-400">{formatCurrency(item.product.price)} l'unite</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="w-7 h-7 rounded-md bg-white border border-secondary-200 flex items-center justify-center hover:bg-secondary-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      disabled={Boolean(stockInfo[item.product.id]?.tracked && item.quantity >= stockInfo[item.product.id].available)}
                      className="w-7 h-7 rounded-md bg-white border border-secondary-200 flex items-center justify-center hover:bg-secondary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-secondary-900">
                      {formatCurrency(item.product.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-xs text-error-500 hover:text-error-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-secondary-100 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-secondary-600">
                <span>Sous-total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-secondary-600">
                <span>Remise</span>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-right text-sm rounded border border-secondary-200 px-2 py-1"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center text-secondary-600">
                <span>Taxe (%)</span>
                <input
                  type="number"
                  value={taxRate || ''}
                  onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-right text-sm rounded border border-secondary-200 px-2 py-1"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center text-secondary-600">
                <span>Pourboire</span>
                <input
                  type="number"
                  value={tip || ''}
                  onChange={(e) => setTip(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-right text-sm rounded border border-secondary-200 px-2 py-1"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between font-bold text-secondary-900 pt-2 border-t border-secondary-100">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowPayment(true)}
              className="btn-primary w-full"
            >
              <CreditCard className="w-4 h-4" />
              Encaisser
            </button>
          </div>
        )}
      </>
    );
  }
}